/**
 * km 单槽工人：executeKmSlotSub（检索 + hits 写）→ FC →（可）局部重检。
 * 不读缓存；查缓存仅在 planCacheResolve。
 */
import { executeKmSlotSub } from "@/agentflow/cache";
import type { CompositeSubRetrieval } from "../composite/interface";
import {
  checkStepFacts,
  subToStepResult,
} from "@/agentflow/agents/online/fact-checker";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
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
  fc: {
    passed: false,
    refinedSearchQuery: null,
    issues: [],
    checkerNotes: notes,
  },
});

/** km 单槽：retrieve + hits 写 → FC →（可）局部重检 */
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
    const corpusUserId = state.context.corpusUserId;
    const plan = state.compositeIncrementalPlan;

    let sub = await executeKmSlotSub({
      corpusUserId,
      plan,
      slot,
    });
    let retried = false;

    let fc = await checkStepFacts({
      userQuestion: state.userQuestion,
      decision: state.decision!,
      sub,
      retryCount: state.retryCount,
      retrievalCacheHit: Boolean(sub.cacheHit),
    });

    if (!fc.passed && fc.refinedSearchQuery && state.retryCount < 1) {
      const refinedSlot: CompositeRetrievalSlot = {
        ...slot,
        searchQuery: fc.refinedSearchQuery,
      };
      sub = await executeKmSlotSub({
        corpusUserId,
        plan,
        slot: refinedSlot,
        liveRetrieve: true,
      });
      retried = true;
      fc = await checkStepFacts({
        userQuestion: state.userQuestion,
        decision: state.decision!,
        sub,
        retryCount: state.retryCount + 1,
        retrievalCacheHit: Boolean(sub.cacheHit),
      });
    }

    const step = subToStepResult(sub, fc, "km");
    return {
      slotId: String(slot.id),
      executor: "km",
      sub,
      stepResult: step,
      error: null,
      retried,
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
