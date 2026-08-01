/**
 * Fan-out 工人入口：套单槽墙钟预算后写回 patch + slotRuntimeById。
 */
import { runWithSlotBudget } from "@/agentflow/execution";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { resolveActiveSlot } from "../active-slot";
import type {
  PlanSlotWorkerKind,
  PlanSlotWorkerPatch,
} from "../interface";

export const emitBudgetedSlotPatch = async (
  state: PipelineGraphState,
  executor: PlanSlotWorkerKind,
  run: () => Promise<PlanSlotWorkerPatch>
): Promise<Partial<PipelineGraphState>> => {
  const slotId = state.activeSlotId ?? "unknown";
  const slot = resolveActiveSlot(state);
  const { patch, slotRuntime } = await runWithSlotBudget({
    slotId,
    executor,
    label: slot?.label ?? slotId,
    policy: state.retryPolicy,
    priorRuntime: state.slotRuntimeById?.[slotId] ?? null,
    run,
  });
  return {
    fanOutSlotPatches: [patch],
    slotRuntimeById: { [slotId]: slotRuntime },
  };
};
