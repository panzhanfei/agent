/**
 * vault_workspace golden probe：pathPlan 合法化 + 磁盘 CRUD/语料化映射（同步，不经 Intake 口语）。
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
  workspaceTxtToCorpusMdRepoPath,
} from "@fambrain/corpus";
import {
  deriveCompositeSlotsFromPathPlan,
  legalizePathPlan,
  stepsOfKind,
} from "@/agentflow/agents/online/intake-coordinator";
import {
  matchVaultWorkspaceUiPrompt,
  vaultWsListPrompt,
  vaultWsOpenPrompt,
} from "@/agentflow/agents/online/vault-write";

export type VaultWorkspaceProbeCase = {
  id: string;
  label: string;
  mode: "list_root" | "create_update_delete" | "ui_prompts";
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
  _corpusUserId: string
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
        const open = matchVaultWorkspaceUiPrompt(vaultWsOpenPrompt("notes/a.txt"));
        const ok =
          list?.type === "list" &&
          list.folderRel === "notes" &&
          open?.type === "open" &&
          open.fileRel === "notes/a.txt";
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

      // create_update_delete：独立临时 doc root，避免污染主库
      const docRoot = await mkdtemp(path.join(os.tmpdir(), "fambrain-vault-probe-"));
      const prev = process.env.FAMBRAIN_DOC_ROOT_OVERRIDE;
      process.env.FAMBRAIN_DOC_ROOT_OVERRIDE = docRoot;
      const uid = `probe-${Date.now()}`;
      try {
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

/** 兼容旧 import 名 */
export type CorpusEditProbeSpec = VaultWorkspaceProbeSpec;
export type CorpusEditProbeResult = VaultWorkspaceProbeResult;
export const runCorpusEditProbe = runVaultWorkspaceProbe;
