/** vault workspace：两层 list + txt/文件夹 CRUD + 语料化钩子 */

import { interrupt } from "@langchain/langgraph";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { paramsFromResume } from "./intake";
import type { VaultWorkspaceParams } from "./interface";
import {
  parseVaultWorkspaceParams,
  rememberVaultWorkspaceOp,
  runVaultWorkspaceOp,
  takeCachedVaultWorkspaceOp,
} from "./ops";
import { missingVaultWorkspaceSlotPatch } from "./missing-slot";

export type {
  VaultWorkspaceListResult,
  VaultWorkspaceOp,
  VaultWorkspaceParams,
} from "./interface";
export { VAULT_WORKSPACE_OPS } from "./interface";

export {
  VAULT_WORKSPACE_ACTION,
  VAULT_WORKSPACE_UI_ENTRY,
  buildVaultWorkspaceListBlocks,
  matchVaultWorkspaceUiPrompt,
  vaultWsCreateFilePrompt,
  vaultWsCreateFolderPrompt,
  vaultWsDeleteFilePrompt,
  vaultWsDeleteFolderPrompt,
  vaultWsListPrompt,
  vaultWsOpenPrompt,
  type VaultWsUiAction,
} from "./actions";

export {
  parseVaultWorkspaceParams,
  purgeOneForTest,
  runVaultWorkspaceOp,
  type VaultWorkspaceRunResult,
} from "./ops";

export {
  buildVaultWorkspaceUiDecision,
  matchVaultWorkspaceUiAction,
  resolveVaultWorkspaceUiBypass,
  toVaultWorkspaceParams,
} from "./intake";

/**
 * vaultWorkspace 节点：执行一次 op 后 interrupt，Command Resume 后继续。
 * 不套槽位墙钟预算。Resume 从节点入口重跑，写操作依赖 op-cache 避免重复执行。
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
    return {
      fanOutSlotPatches: [missingVaultWorkspaceSlotPatch(state)],
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
