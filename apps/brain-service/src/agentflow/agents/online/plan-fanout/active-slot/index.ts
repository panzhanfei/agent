import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

/** planFanOut Send 工人：从 state.activeSlotId 解析当前槽 */
export const resolveActiveSlot = (
  state: PipelineGraphState
): CompositeRetrievalSlot | null => {
  const id = state.activeSlotId?.trim();
  if (!id || !state.decision) return null;
  return (
    state.decision.compositeSlots.find((s) => String(s.id) === id) ?? null
  );
};
