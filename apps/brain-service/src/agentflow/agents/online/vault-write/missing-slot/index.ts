/**
 * 缺槽错误补丁。图主路径 HITL 在包根 `runVaultWorkspaceNode`；
 * 只有 resolveActiveSlot 失败时才进这里，不再跑 list/CRUD。
 */
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

const emptySub = (
  slotId: string,
  label: string,
  notes: string | null
): CompositeSubRetrieval => ({
  slot: slotId,
  label,
  hits: [],
  coverage: notes ? "sufficient" : "none",
  notes,
  cacheHit: false,
  facetAnswerCacheHit: false,
  dataSource: "corpus",
});

/** 包根判定没槽之后调用：不再 resolve 一次、也不跑 op。 */
export const missingVaultWorkspaceSlotPatch = (
  state: PipelineGraphState
): PlanSlotWorkerPatch => {
  const slotId = state.activeSlotId?.trim() || "unknown";
  return {
    slotId,
    executor: "vault_workspace",
    sub: emptySub(slotId, "unknown", "缺少 activeSlotId"),
    stepResult: {
      stepId: slotId,
      pathKind: "vault_workspace",
      label: "unknown",
      hits: [],
      coverage: "none",
      notes: "缺少 activeSlotId",
      confidenceTier: null,
      enumerationMeta: null,
      cacheHit: false,
    },
    error: "缺少 activeSlotId",
  };
};
