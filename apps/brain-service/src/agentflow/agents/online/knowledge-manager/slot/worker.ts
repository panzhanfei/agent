/**
 * km 单槽工人：executeKmSlotSub → 出 hits。
 * 改 query / 再检只走 Join 后全局 B。
 */
import {
  subToStepResult,
  type StepResult,
} from "@/agentflow/agents/online/intake-coordinator/path-plan";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { CompositeSubRetrieval } from "../composite/interface";
import { executeKmSlotSub } from "./execute-sub";

const emptySub = (
  slotId: string,
  label: string,
  notes: string | null
): CompositeSubRetrieval => ({
  slot: slotId,
  label,
  hits: [],
  coverage: "none",
  notes,
  cacheHit: false,
  facetAnswerCacheHit: false,
});

const failedStep = (
  slotId: string,
  label: string,
  notes: string
): StepResult => ({
  stepId: slotId,
  pathKind: "km",
  label,
  hits: [],
  coverage: "none",
  notes,
  confidenceTier: null,
  enumerationMeta: null,
  cacheHit: false,
});

/** km 单槽工人：仅 retrieve */
export const runKmSlotWorker = async (
  state: PipelineGraphState
): Promise<PlanSlotWorkerPatch> => {
  const slot = resolveActiveSlot(state);
  const slotId = state.activeSlotId ?? "unknown";
  if (!slot) {
    return {
      slotId,
      executor: "km",
      sub: emptySub(slotId, "unknown", "缺少 activeSlotId"),
      stepResult: failedStep(slotId, "unknown", "缺少 activeSlotId"),
      error: "缺少 activeSlotId",
    };
  }

  try {
    const sub = await executeKmSlotSub({
      corpusUserId: state.context.corpusUserId,
      plan: state.compositeIncrementalPlan,
      slot,
    });
    return {
      slotId: String(slot.id),
      executor: "km",
      sub,
      stepResult: subToStepResult(sub, "km"),
      error: null,
      retried: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "km 单槽检索失败";
    const sub = emptySub(String(slot.id), slot.label, msg);
    return {
      slotId: String(slot.id),
      executor: "km",
      sub,
      stepResult: failedStep(String(slot.id), slot.label, msg),
      error: msg,
    };
  }
};
