/** vault workspace：两层 list + txt/文件夹 CRUD + 语料化钩子 */

export type {
  VaultWorkspaceListResult,
  VaultWorkspaceOp,
  VaultWorkspaceParams,
} from "./interface";
export { VAULT_WORKSPACE_OPS } from "./interface";

export {
  VAULT_WORKSPACE_ACTION,
  VAULT_WORKSPACE_UI_ENTRY,
  matchVaultWorkspaceUiPrompt,
  vaultWsCreateFilePrompt,
  vaultWsCreateFolderPrompt,
  vaultWsDeleteFilePrompt,
  vaultWsDeleteFolderPrompt,
  vaultWsListPrompt,
  vaultWsOpenPrompt,
  type VaultWsUiAction,
} from "./actions";

export { buildVaultWorkspaceListBlocks } from "./compose-actions";

export {
  parseVaultWorkspaceParams,
  purgeOneForTest,
  runVaultWorkspaceOp,
  type VaultWorkspaceRunResult,
} from "./ops";

export { runVaultWorkspaceSlotWorker } from "./slot";
export {
  resolveVaultWorkspaceUiBypass,
  buildVaultWorkspaceUiDecision,
  matchVaultWorkspaceUiAction,
  toVaultWorkspaceParams,
} from "./intake-bypass";

import { interrupt } from "@langchain/langgraph";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PipelineResumePayload } from "@/agentflow/execution";
import {
  matchVaultWorkspaceUiPrompt,
  VAULT_WORKSPACE_UI_ENTRY,
} from "./actions";
import { toVaultWorkspaceParams } from "./intake-bypass";
import {
  parseVaultWorkspaceParams,
  runVaultWorkspaceOp,
} from "./ops";
import type { VaultWorkspaceParams } from "./interface";
import {
  rememberVaultWorkspaceOp,
  takeCachedVaultWorkspaceOp,
} from "./op-cache";
import { runVaultWorkspaceSlotWorker } from "./slot";

const paramsFromResume = (
  resume: unknown,
  fallback: VaultWorkspaceParams
): VaultWorkspaceParams => {
  if (!resume || typeof resume !== "object") return fallback;
  const r = resume as PipelineResumePayload & { prompt?: string };
  if (r.kind === "continue") return fallback;
  const prompt = typeof r.prompt === "string" ? r.prompt : "";
  if (!prompt.trim()) return fallback;
  const q = prompt.trim();
  const action =
    q === VAULT_WORKSPACE_UI_ENTRY
      ? ({ type: "list", folderRel: "" } as const)
      : matchVaultWorkspaceUiPrompt(q);
  if (!action) return fallback;
  return toVaultWorkspaceParams(action);
};

/**
 * LangGraph `vaultWorkspace`：跑一次 op 后 interrupt，Resume 再跑。
 * 不走 60s 预算 race（等人点按钮会超过墙钟）。
 */
export const runVaultWorkspaceNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("VaultWrite", "进入", {
    via: "vaultWorkspace",
    slotId: state.activeSlotId,
  });

  const slot = resolveActiveSlot(state);
  if (!slot) {
    const out = await runVaultWorkspaceSlotWorker(state);
    return {
      fanOutSlotPatches: [out],
    };
  }

  let params: VaultWorkspaceParams =
    parseVaultWorkspaceParams(
      (slot.params as Record<string, unknown> | undefined) ?? null
    ) ?? {
      operation: "list",
      targetPath: String(slot.searchQuery ?? "").trim() || "",
    };
  const language = state.decision?.language === "en" ? "en" : "zh";

  const conversationId = state.context.conversationId;
  for (;;) {
    let result = takeCachedVaultWorkspaceOp(conversationId, params);
    if (!result) {
      result = await runVaultWorkspaceOp({
        corpusUserId: state.context.corpusUserId,
        params,
        language,
      });
      rememberVaultWorkspaceOp(conversationId, params, result);
    }
    const resume: unknown = interrupt({
      kind: "vault_wait",
      answer: result.answer,
      blocks: result.blocks ?? [],
    });
    params = paramsFromResume(resume, params);
  }
};
