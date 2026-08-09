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
export { resolveVaultWorkspaceUiBypass } from "./intake-bypass";

import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { emitBudgetedSlotPatch } from "@/agentflow/agents/online/plan-fanout/slot-budget";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { runVaultWorkspaceSlotWorker } from "./slot";

/** LangGraph `vaultWorkspace` 节点：Send 工人 */
export const runVaultWorkspaceNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("VaultWrite", "进入", {
    via: "vaultWorkspace",
    slotId: state.activeSlotId,
  });

  const out = await emitBudgetedSlotPatch(state, "vault_workspace", () =>
    runVaultWorkspaceSlotWorker(state)
  );
  const patch = out.fanOutSlotPatches?.[0];

  logAgentOut("VaultWrite", "出去", {
    via: "vaultWorkspace",
    slotId: patch?.slotId ?? state.activeSlotId,
    slotStatus: patch?.slotRuntime?.status ?? null,
    notesPreview: patch?.sub.notes?.slice(0, 120) ?? null,
  });

  return out;
};
