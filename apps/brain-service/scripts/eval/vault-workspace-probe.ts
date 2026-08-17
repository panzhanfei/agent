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
import {
  matchVaultWorkspaceUiPrompt,
  vaultWsCreateFilePrompt,
  vaultWsCreateFolderPrompt,
  vaultWsDeleteFilePrompt,
  vaultWsListPrompt,
  vaultWsOpenPrompt,
  VAULT_WORKSPACE_UI_ENTRY,
  buildVaultSaveGateBlocks,
  parseVaultSaveResume,
  sanitizeVaultSaveBasename,
  shouldOfferVaultSaveGate,
  VAULT_SAVE_CANCEL_PROMPT,
  VAULT_SAVE_CONFIRM_PROMPT,
} from "@/agentflow/agents/online/vault-write";

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
    | "save_gate_prompts";
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
        const { runPipelineStream } = await import("@/agentflow/pipeline");
        const context = {
          actorUserId: corpusUserId,
          corpusUserId,
          displayName: "eval-vault",
          conversationId: `eval-vault-list-${Date.now()}`,
        };
        const history = [
          { role: "user" as const, content: VAULT_WORKSPACE_UI_ENTRY },
        ];
        let answer = "";
        const gen = runPipelineStream(history, context);
        while (true) {
          const next = await gen.next();
          if (next.done) {
            answer = next.value?.answer ?? answer;
            const paused = Boolean(next.value?.paused);
            const ok =
              paused &&
              /原文库|Workspace|暂无文件|项：|新建/.test(answer) &&
              !/再说清楚|哪一方面|请明确/.test(answer);
            results.push({
              id: c.id,
              tier: "pipeline",
              label: c.label,
              pass: ok,
              reason: ok
                ? `pipeline list pause ok (${answer.slice(0, 80).replace(/\n/g, " ")})`
                : `pipeline list bad paused=${paused}: ${answer.slice(0, 160)}`,
              latencyMs: Date.now() - started,
            });
            break;
          }
          if (next.value.type === "assistant") {
            answer += next.value.text;
          }
          if (next.value.type === "paused" && next.value.answer) {
            answer = next.value.answer;
          }
        }
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
        const summarize = shouldOfferVaultSaveGate({
          answer: "draft",
          error: null,
          decision: {
            composeMode: "summarize",
            intent: "summarize_content",
            attachmentAction: null,
          } as never,
        });
        const translate = shouldOfferVaultSaveGate({
          answer: "draft",
          error: null,
          decision: {
            composeMode: "qa",
            intent: "retrieve_and_answer",
            attachmentAction: "translate",
          } as never,
        });
        const qa = shouldOfferVaultSaveGate({
          answer: "draft",
          error: null,
          decision: {
            composeMode: "qa",
            intent: "retrieve_and_answer",
            attachmentAction: null,
          } as never,
        });
        const ok = summarize && translate && !qa;
        results.push({
          id: c.id,
          tier: "pipeline",
          label: c.label,
          pass: ok,
          reason: ok
            ? "offer rules ok"
            : `summarize=${summarize} translate=${translate} qa=${qa}`,
          latencyMs: Date.now() - started,
        });
        continue;
      }
      if (c.mode === "save_gate_prompts") {
        const built = buildVaultSaveGateBlocks({ draft: "hello" });
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
