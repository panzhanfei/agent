/**
 * Fan-out 工人入口：套单槽墙钟预算后写回 patch + slotRuntimeById。
 */
import {
  getTurn,
  getTurnAbortReason,
  runWithSlotBudget,
} from "@/agentflow/execution";
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
  const registered = getTurn(state.turnId);
  const { patch, slotRuntime } = await runWithSlotBudget({
    slotId,
    executor,
    label: slot?.label ?? slotId,
    policy: state.retryPolicy,
    priorRuntime: state.slotRuntimeById?.[slotId] ?? null,
    signal: registered?.controller.signal ?? null,
    abortReason: getTurnAbortReason(state.turnId),
    run,
  });
  return {
    fanOutSlotPatches: [patch],
    slotRuntimeById: { [slotId]: slotRuntime },
    ...(registered?.controller.signal.aborted
      ? { turnAborted: true }
      : {}),
  };
};
