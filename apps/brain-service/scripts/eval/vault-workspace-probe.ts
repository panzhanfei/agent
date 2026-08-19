/**
 * vault_workspace golden probe：pathPlan / UI / 磁盘 CRUD / pipeline list。
 */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createVaultWorkspaceFolder,
  createVaultWorkspaceTxt,
  deleteVaultWorkspaceTxt,
  listVaultWorkspaceDir,
  materializeWorkspaceTxt,
  purgeWorkspaceMaterialized,
  readMaterializedMd,
  writeVaultWorkspaceTxt,
  workspaceTxtToCorpusMdRepoPath,
} from "@fambrain/corpus";
import {
  deriveCompositeSlotsFromPathPlan,
  legalizePathPlan,
  stepsOfKind,
} from "@/agentflow/agents/online/intake-coordinator";
import type { AgentPipelineContext, AgentPipelineResult, DbChatTurn } from "@fambrain/brain-types";
import {
  FILE_JOB_TTL_MS,
  matchVaultWorkspaceUiPrompt,
  vaultWsCreateFilePrompt,
  vaultWsCreateFolderPrompt,
  vaultWsDeleteFilePrompt,
  vaultWsListPrompt,
  vaultWsOpenPrompt,
  VAULT_WORKSPACE_UI_ENTRY,
} from "@/agentflow/agents/sideline/file";
import {
  buildVaultSaveGateBlocks,
  parseVaultSaveResume,
  sanitizeVaultSaveBasename,
  shouldHandoffFromPipelineState,
  VAULT_SAVE_CANCEL_PROMPT,
  VAULT_SAVE_CONFIRM_PROMPT,
} from "@/agentflow/agents/sideline/file";

export type VaultWorkspaceProbeCase = {
  id: string;
  label: string;
  mode:
    | "list_root"
    | "create_update_delete"
    | "ui_prompts"
    | "ui_crud_prompts"
    | "nested_folder"
    | "update_body"
    | "pipeline_list"
    | "save_gate_sanitize"
    | "save_gate_offer"
    | "save_gate_prompts"
    | "resume_requires_jobid"
    | "file_thread_independent"
    | "qa_no_save_offer"
    | "save_offer_from_attachments"
    | "workspace_superseded_by_qa"
    | "save_offer_survives_qa"
    | "file_job_ttl_expire";
};

export type VaultWorkspaceProbeSpec = {
  id: string;
  label: string;
  cases: VaultWorkspaceProbeCase[];
};

export type VaultWorkspaceProbeResult = {
  id: string;
  tier: "pipeline";
  label: string;
  pass: boolean;
  reason: string;
  latencyMs: number;
};

const ATTACH_BODY =
  "FamBrain 原文库只写 txt。写回闸门只在总结或翻译新材料后询问是否入库。普通问答、查库摘要、extract 不出闸。本段仅用于评测覆盖，与城管平台无关。".repeat(4);

type OrchestrateSnap = {
  answer: string;
  jobId?: string;
  paused: boolean;
  sawMainComplete: boolean;
  steps: string[];
  result?: AgentPipelineResult;
};

const collectOrchestrate = async (
  history: DbChatTurn[],
  context: AgentPipelineContext
): Promise<OrchestrateSnap> => {
  const { orchestrateAgentStream } = await import("@/agentflow/pipeline");
  let answer = "";
  let jobId: string | undefined;
  let paused = false;
  let sawMainComplete = false;
  const steps: string[] = [];
  const gen = orchestrateAgentStream(history, context);
  while (true) {
    const next = await gen.next();
    if (next.done) {
      const result = next.value;
      answer = result?.answer ?? answer;
      paused = Boolean(result?.paused) || paused;
      jobId = result?.jobId ?? jobId;
      return { answer, jobId, paused, sawMainComplete, steps, result };
    }
    const ev = next.value;
    if (ev.type === "step" && ev.status === "running") steps.push(ev.name);
    if (ev.type === "assistant") answer += ev.text;
    if (ev.type === "main_turn_complete") sawMainComplete = true;
    if (ev.type === "paused") {
      paused = true;
      if (ev.answer) answer = ev.answer;
      jobId = ev.jobId ?? jobId;
    }
  }
};

const evalConvContext = async (
  corpusUserId: string,
  title: string
): Promise<{ conversationId: string; context: AgentPipelineContext }> => {
  const { prisma } = await import("@fambrain/db");
  const conv = await prisma.conversation.create({
    data: { title },
    select: { id: true },
  });
  return {
    conversationId: conv.id,
    context: {
      actorUserId: corpusUserId,
      corpusUserId,
      displayName: "eval-vault",
      conversationId: conv.id,
    },
  };
};

const pathPlanListOk = (): boolean => {
  const plan = legalizePathPlan({
    steps: [
      {
        id: "vault-list",
        kind: "vault_workspace",
        label: "原文库列表",
        searchQuery: "",
        queryType: "default",
        topics: ["personal"],
        params: { operation: "list", targetPath: "" },
      },
    ],
  });
  const slots = deriveCompositeSlotsFromPathPlan(plan);
  return (
    stepsOfKind(plan, "vault_workspace").length === 1 &&
    slots[0]?.executor === "vault_workspace" &&
    slots[0]?.params?.operation === "list"
  );
};

export const runVaultWorkspaceProbe = async (
  spec: VaultWorkspaceProbeSpec,
  corpusUserId: string
): Promise<VaultWorkspaceProbeResult[]> => {
  const results: VaultWorkspaceProbeResult[] = [];
  for (const c of spec.cases) {
    const started = Date.now();
    try {
      if (c.mode === "list_root") {
        const ok = pathPlanListOk();
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok ? "pathPlan list ok" : "pathPlan list failed",
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "ui_prompts") {
        const list = matchVaultWorkspaceUiPrompt(vaultWsListPrompt("notes"));
        const open = matchVaultWorkspaceUiPrompt(
          vaultWsOpenPrompt("notes/a.txt")
        );
        const entryOk = VAULT_WORKSPACE_UI_ENTRY.trim() === "我的原文库";
        const ok =
          list?.type === "list" &&
          list.folderRel === "notes" &&
          open?.type === "open" &&
          open.fileRel === "notes/a.txt" &&
          entryOk;
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok ? "ui prompts ok" : "ui prompt mismatch",
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "ui_crud_prompts") {
        const createF = matchVaultWorkspaceUiPrompt(
          vaultWsCreateFilePrompt("notes")
        );
        const createD = matchVaultWorkspaceUiPrompt(
          vaultWsCreateFolderPrompt("notes")
        );
        const del = matchVaultWorkspaceUiPrompt(
          vaultWsDeleteFilePrompt("notes/a.txt")
        );
        const ok =
          createF?.type === "create_file" &&
          createF.folderRel === "notes" &&
          createD?.type === "create_folder" &&
          createD.folderRel === "notes" &&
          del?.type === "delete_file" &&
          del.fileRel === "notes/a.txt";
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok ? "ui crud prompts ok" : "ui crud prompt mismatch",
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "pipeline_list") {
        const { orchestrateAgentStream } = await import("@/agentflow/pipeline");
        const { prisma } = await import("@fambrain/db");
        const conv = await prisma.conversation.create({
          data: { title: `eval-vault-list-${Date.now()}` },
          select: { id: true },
        });
        const context = {
          actorUserId: corpusUserId,
          corpusUserId,
          displayName: "eval-vault",
          conversationId: conv.id,
        };
        const history = [
          { role: "user" as const, content: VAULT_WORKSPACE_UI_ENTRY },
        ];
        let answer = "";
        let jobId: string | undefined;
        const gen = orchestrateAgentStream(history, context);
        while (true) {
          const next = await gen.next();
          if (next.done) {
            answer = next.value?.answer ?? answer;
            const paused = Boolean(next.value?.paused);
            jobId = next.value?.jobId ?? jobId;
            const ok =
              paused &&
              Boolean(jobId) &&
              /原文库|Workspace|暂无文件|项：|新建/.test(answer) &&
              !/再说清楚|哪一方面|请明确/.test(answer);
            results.push({
              id: c.id,
              tier: "pipeline",
              label: c.label,
              pass: ok,
              reason: ok
                ? `file list pause ok jobId=${jobId} (${answer.slice(0, 80).replace(/\n/g, " ")})`
                : `pipeline list bad paused=${paused} jobId=${jobId ?? "none"}: ${answer.slice(0, 160)}`,
              latencyMs: Date.now() - started,
            });
            break;
          }
          if (next.value.type === "assistant") {
            answer += next.value.text;
          }
          if (next.value.type === "paused") {
            if (next.value.answer) answer = next.value.answer;
            jobId = next.value.jobId ?? jobId;
          }
        }
        continue;
      }
      if (c.mode === "resume_requires_jobid") {
        const { orchestrateAgentStream } = await import("@/agentflow/pipeline");
        const gen = orchestrateAgentStream(
          [{ role: "user", content: "确定入库" }],
          {
            actorUserId: corpusUserId,
            corpusUserId,
            displayName: "eval-vault",
            conversationId: `eval-vault-resume-${Date.now()}`,
            resume: {
              kind: "vault_action",
              jobId: "",
              prompt: VAULT_SAVE_CONFIRM_PROMPT,
            },
          }
        );
        let answer = "";
        while (true) {
          const next = await gen.next();
          if (next.done) {
            answer = next.value?.answer ?? answer;
            break;
          }
        }
        const ok = /缺少 jobId/.test(answer);
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok ? "resume without jobId rejected" : `got: ${answer.slice(0, 120)}`,
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "file_thread_independent") {
        const {
          discardFileTask,
          discardPipelineTask,
          fileThreadId,
          pipelineThreadId,
        } = await import("@/agentflow/execution");
        const conv = `eval-file-thread-${Date.now()}`;
        discardPipelineTask(conv);
        const qa = pipelineThreadId(conv);
        const file0 = fileThreadId(conv);
        const file1 = discardFileTask(conv);
        const ok =
          qa !== file0 &&
          file0.startsWith("fambrain-file:") &&
          file1 !== file0 &&
          pipelineThreadId(conv) === qa;
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok
            ? `qa=${qa} file0=${file0} file1=${file1}`
            : `qa=${qa} file0=${file0} file1=${file1}`,
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "save_gate_sanitize") {
        const ok =
          sanitizeVaultSaveBasename("  notes/a.txt  ") === "notesa" &&
          sanitizeVaultSaveBasename("foo.TXT") === "foo" &&
          sanitizeVaultSaveBasename("") === null &&
          parseVaultSaveResume({
            kind: "vault_action",
            prompt: VAULT_SAVE_CONFIRM_PROMPT,
            name: "memo",
          }).kind === "confirm" &&
          parseVaultSaveResume({
            kind: "vault_action",
            prompt: VAULT_SAVE_CANCEL_PROMPT,
          }).kind === "cancel" &&
          parseVaultSaveResume({
            kind: "vault_action",
            prompt: VAULT_SAVE_CONFIRM_PROMPT,
            name: "",
          }).kind === "unknown";
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok ? "save-gate sanitize/resume ok" : "save-gate sanitize fail",
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "save_gate_offer") {
        const pasted = shouldHandoffFromPipelineState({
          answer: "draft",
          error: null,
          decision: {
            composeMode: "summarize",
            intent: "summarize_content",
            searchQuery: "",
            pathPlan: { steps: [] },
            attachmentAction: null,
          } as never,
        });
        const corpus = shouldHandoffFromPipelineState({
          answer: "draft",
          error: null,
          decision: {
            composeMode: "summarize",
            intent: "summarize_content",
            searchQuery: "城管平台 技术栈",
            pathPlan: { steps: [{ kind: "km" }] },
            attachmentAction: null,
          } as never,
        });
        const translate = shouldHandoffFromPipelineState({
          answer: "draft",
          error: null,
          decision: {
            composeMode: "qa",
            intent: "retrieve_and_answer",
            attachmentAction: "translate",
          } as never,
        });
        const qa = shouldHandoffFromPipelineState({
          answer: "draft",
          error: null,
          decision: {
            composeMode: "qa",
            intent: "retrieve_and_answer",
            attachmentAction: null,
          } as never,
        });
        const ok = pasted && translate && !corpus && !qa;
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok
            ? "offer rules ok"
            : `pasted=${pasted} translate=${translate} corpus=${corpus} qa=${qa}`,
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "save_gate_prompts") {
        const built = buildVaultSaveGateBlocks({ language: "zh" });
        const actions = built.blocks.find((b) => b.type === "actions");
        const prompts =
          actions?.type === "actions"
            ? actions.actions.map((a) => a.prompt)
            : [];
        const handler =
          actions?.type === "actions"
            ? actions.actions[0]?.clientHandler
            : undefined;
        const ok =
          prompts[0] === VAULT_SAVE_CONFIRM_PROMPT &&
          prompts[1] === VAULT_SAVE_CANCEL_PROMPT &&
          handler === "vault_save_name";
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok ? "save-gate prompts ok" : `prompts=${prompts.join(",")}`,
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "qa_no_save_offer") {
        const { context } = await evalConvContext(
          corpusUserId,
          `eval-qa-no-save-${Date.now()}`
        );
        const snap = await collectOrchestrate(
          [{ role: "user", content: "你好" }],
          context
        );
        const ok =
          !snap.paused &&
          !snap.jobId &&
          !snap.sawMainComplete &&
          !snap.steps.includes("file_agent") &&
          snap.answer.trim().length > 0;
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok
            ? "qa/chitchat did not start file line"
            : `paused=${snap.paused} jobId=${snap.jobId ?? "none"} main=${snap.sawMainComplete} steps=${snap.steps.join(",")}`,
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "save_offer_from_attachments") {
        const { conversationId, context } = await evalConvContext(
          corpusUserId,
          `eval-save-offer-${Date.now()}`
        );
        const snap = await collectOrchestrate(
          [{ role: "user", content: "请总结这个附件" }],
          {
            ...context,
            turnAttachments: [
              {
                fileName: "eval-memo.md",
                title: "eval-memo",
                text: ATTACH_BODY,
                format: "markdown",
                textLength: ATTACH_BODY.length,
              },
            ],
          }
        );
        const offered =
          snap.paused &&
          Boolean(snap.jobId) &&
          snap.sawMainComplete &&
          snap.steps.includes("file_agent") &&
          /确定入库|写入原文库|Save/.test(snap.answer);
        if (!offered || !snap.jobId) {
          results.push({
            id: c.id,
            tier: "pipeline",
            label: c.label,
            pass: false,
            reason: `save_offer missing paused=${snap.paused} jobId=${snap.jobId ?? "none"} main=${snap.sawMainComplete} steps=${snap.steps.join(",")} answer=${snap.answer.slice(0, 160).replace(/\n/g, " ")}`,
            latencyMs: Date.now() - started,
          });
          continue;
        }
        const cancel = await collectOrchestrate(
          [{ role: "user", content: "取消入库" }],
          {
            ...context,
            conversationId,
            resume: {
              kind: "vault_action",
              jobId: snap.jobId,
              prompt: VAULT_SAVE_CANCEL_PROMPT,
            },
          }
        );
        const { getFileJob } = await import("@fambrain/db");
        const after = await getFileJob(snap.jobId);
        const ok = !cancel.paused && after?.status === "cancelled";
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok
            ? `save_offer + cancel ok jobId=${snap.jobId}`
            : `cancel paused=${cancel.paused} status=${after?.status ?? "missing"} answer=${cancel.answer.slice(0, 120)}`,
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "workspace_superseded_by_qa") {
        const { conversationId, context } = await evalConvContext(
          corpusUserId,
          `eval-ws-supersede-${Date.now()}`
        );
        const list = await collectOrchestrate(
          [{ role: "user", content: VAULT_WORKSPACE_UI_ENTRY }],
          context
        );
        if (!list.jobId || !list.paused) {
          results.push({
            id: c.id,
            tier: "pipeline",
            label: c.label,
            pass: false,
            reason: `workspace list missing pause jobId=${list.jobId ?? "none"}`,
            latencyMs: Date.now() - started,
          });
          continue;
        }
        const qa = await collectOrchestrate(
          [
            { role: "user", content: VAULT_WORKSPACE_UI_ENTRY },
            { role: "assistant", content: list.answer },
            { role: "user", content: "你好" },
          ],
          { ...context, conversationId }
        );
        const { getFileJob } = await import("@fambrain/db");
        const job = await getFileJob(list.jobId);
        const ok =
          job?.status === "superseded" &&
          !qa.paused &&
          !qa.steps.includes("file_agent");
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok
            ? `workspace superseded by QA job=${list.jobId}`
            : `status=${job?.status ?? "missing"} qaPaused=${qa.paused} steps=${qa.steps.join(",")}`,
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "save_offer_survives_qa") {
        const { conversationId, context } = await evalConvContext(
          corpusUserId,
          `eval-save-keep-${Date.now()}`
        );
        const { createFileJob, getFileJob, markFileJobPaused } = await import(
          "@fambrain/db"
        );
        const { fileThreadId } = await import("@/agentflow/execution");
        const threadId = fileThreadId(conversationId);
        const job = await createFileJob({
          conversationId,
          corpusUserId,
          fileThreadId: threadId,
          fileGeneration: 0,
          task: "save_offer",
          envelope: {
            task: "save_offer",
            draft: "评测终稿",
            attachmentAction: "summarize",
            composeMode: "summarize",
            intent: "summarize_content",
            hasPathSteps: false,
            hasSearchQuery: false,
            language: "zh",
          },
        });
        await markFileJobPaused({
          id: job.id,
          answer: "可将本轮终稿写入原文库",
        });
        await collectOrchestrate(
          [{ role: "user", content: "你好" }],
          { ...context, conversationId }
        );
        const after = await getFileJob(job.id);
        const ok = after?.status === "paused";
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok
            ? `save_offer kept across QA job=${job.id}`
            : `status=${after?.status ?? "missing"}`,
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "file_job_ttl_expire") {
        const { conversationId } = await evalConvContext(
          corpusUserId,
          `eval-ttl-${Date.now()}`
        );
        const { createFileJob, expireStaleFileJobs, getFileJob, prisma } =
          await import("@fambrain/db");
        const { fileThreadId } = await import("@/agentflow/execution");
        const job = await createFileJob({
          conversationId,
          corpusUserId,
          fileThreadId: fileThreadId(conversationId),
          fileGeneration: 0,
          task: "workspace",
          envelope: {
            task: "workspace",
            draft: "",
            attachmentAction: null,
            composeMode: "qa",
            intent: null,
            hasPathSteps: true,
            hasSearchQuery: false,
            language: "zh",
            workspaceOp: { operation: "list", targetPath: "" },
          },
        });
        await prisma.fileJob.update({
          where: { id: job.id },
          data: {
            status: "paused",
            updatedAt: new Date(Date.now() - FILE_JOB_TTL_MS - 5000),
          },
        });
        const expired = await expireStaleFileJobs(conversationId, FILE_JOB_TTL_MS);
        const after = await getFileJob(job.id);
        const ok = expired.includes(job.id) && after?.status === "cancelled";
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok
            ? `ttl expired job=${job.id}`
            : `expired=${expired.join(",")} status=${after?.status ?? "missing"}`,
          latencyMs: Date.now() - started,
        });
        continue;
      }

      // 磁盘类用例：独立临时 doc root
      const docRoot = await mkdtemp(
        path.join(os.tmpdir(), "fambrain-vault-probe-")
      );
      const prev = process.env.FAMBRAIN_DOC_ROOT_OVERRIDE;
      process.env.FAMBRAIN_DOC_ROOT_OVERRIDE = docRoot;
      const uid = `probe-${Date.now()}`;
      try {
        if (c.mode === "create_update_delete") {
          await createVaultWorkspaceFolder(uid, "", "notes");
          await createVaultWorkspaceTxt(uid, "notes", "hello.txt", "hello world");
          const listed = await listVaultWorkspaceDir(uid, "notes");
          const mat = await materializeWorkspaceTxt({
            corpusUserId: uid,
            workspaceRel: "notes/hello.txt",
            indexAfter: false,
          });
          const md = await readMaterializedMd(uid, "notes/hello.txt");
          const mapped = workspaceTxtToCorpusMdRepoPath(uid, "notes/hello.txt");
          await deleteVaultWorkspaceTxt(uid, "notes/hello.txt");
          await purgeWorkspaceMaterialized({
            corpusUserId: uid,
            workspaceRel: "notes/hello.txt",
          });
          const mdAfter = await readMaterializedMd(uid, "notes/hello.txt");
          const ok =
            listed.length === 1 &&
            Boolean(md?.includes("hello world")) &&
            mat.mdRepoPath === mapped &&
            mdAfter === null;
          results.push({
            id: c.id,
            tier: "pipeline",
            label: c.label,
            pass: ok,
            reason: ok
              ? "crud+materialize+purge ok"
              : `fail listed=${listed.length} md=${Boolean(md)} after=${mdAfter}`,
            latencyMs: Date.now() - started,
          });
        } else if (c.mode === "nested_folder") {
          await createVaultWorkspaceFolder(uid, "", "notes");
          await createVaultWorkspaceFolder(uid, "notes", "sub");
          await createVaultWorkspaceTxt(
            uid,
            "notes/sub",
            "a.txt",
            "nested body"
          );
          const mat = await materializeWorkspaceTxt({
            corpusUserId: uid,
            workspaceRel: "notes/sub/a.txt",
            indexAfter: false,
          });
          const mapped = workspaceTxtToCorpusMdRepoPath(
            uid,
            "notes/sub/a.txt"
          );
          const md = await readMaterializedMd(uid, "notes/sub/a.txt");
          await deleteVaultWorkspaceTxt(uid, "notes/sub/a.txt");
          await purgeWorkspaceMaterialized({
            corpusUserId: uid,
            workspaceRel: "notes/sub/a.txt",
          });
          const after = await readMaterializedMd(uid, "notes/sub/a.txt");
          const ok =
            mat.mdRepoPath === mapped &&
            Boolean(md?.includes("nested body")) &&
            after === null &&
            /imports\/workspace\/notes\/sub\/a\.md$/.test(mapped);
          results.push({
            id: c.id,
            tier: "pipeline",
            label: c.label,
            pass: ok,
            reason: ok ? "nested path ok" : `mapped=${mapped} after=${after}`,
            latencyMs: Date.now() - started,
          });
        } else if (c.mode === "update_body") {
          await createVaultWorkspaceFolder(uid, "", "notes");
          await createVaultWorkspaceTxt(uid, "notes", "u.txt", "v1");
          await materializeWorkspaceTxt({
            corpusUserId: uid,
            workspaceRel: "notes/u.txt",
            indexAfter: false,
          });
          await writeVaultWorkspaceTxt(uid, "notes/u.txt", "v2-updated");
          await materializeWorkspaceTxt({
            corpusUserId: uid,
            workspaceRel: "notes/u.txt",
            indexAfter: false,
          });
          const md = await readMaterializedMd(uid, "notes/u.txt");
          const ok = Boolean(md?.includes("v2-updated")) && !md?.includes("v1\n");
          await deleteVaultWorkspaceTxt(uid, "notes/u.txt");
          await purgeWorkspaceMaterialized({
            corpusUserId: uid,
            workspaceRel: "notes/u.txt",
          });
          results.push({
            id: c.id,
            tier: "pipeline",
            label: c.label,
            pass: ok,
            reason: ok ? "update+rematerialize ok" : `md=${md?.slice(0, 80)}`,
            latencyMs: Date.now() - started,
          });
        } else {
          results.push({
            id: c.id,
            tier: "pipeline",
            label: c.label,
            pass: false,
            reason: `unknown mode ${(c as { mode: string }).mode}`,
            latencyMs: Date.now() - started,
          });
        }
      } finally {
        if (prev === undefined) delete process.env.FAMBRAIN_DOC_ROOT_OVERRIDE;
        else process.env.FAMBRAIN_DOC_ROOT_OVERRIDE = prev;
        await rm(docRoot, { recursive: true, force: true });
      }
    } catch (e) {
      results.push({
        id: c.id,
        tier: "pipeline",
        label: c.label,
        pass: false,
        reason: e instanceof Error ? e.message : String(e),
        latencyMs: Date.now() - started,
      });
    }
  }
  return results;
};
