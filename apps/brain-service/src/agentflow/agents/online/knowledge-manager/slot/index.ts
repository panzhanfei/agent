/**
 * km 单槽工人：读 planCacheResolve 预置缓存 → FC →（可）局部重检。
 * 供 LangGraph kmRetrieve Send 节点调用。
 */
import {
  attachFacetKey,
  findSlotCachePlan,
  retrieveKmWithHitsCache,
  subFromFacetCache,
  subFromHits,
} from "@/agentflow/cache";
import type { CompositeSubRetrieval } from "../composite/interface";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import {
  checkStepFacts,
  subToStepResult,
} from "@/agentflow/agents/online/fact-checker";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
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

/** 读 state 内预置 plan；FC 重检走 live hits cache */
const retrieveKmOne = async (
  state: PipelineGraphState,
  slot: CompositeRetrievalSlot,
  options?: { liveRetrieve?: boolean }
): Promise<CompositeSubRetrieval> => {
  const planSlot = findSlotCachePlan(state.compositeIncrementalPlan, slot.id);
  const withKey = attachFacetKey(slot);

  if (
    !options?.liveRetrieve &&
    planSlot?.useCachedAnswer &&
    planSlot.cachedAnswer
  ) {
    return subFromFacetCache(slot, planSlot);
  }

  if (!options?.liveRetrieve && planSlot?.preresolvedHits) {
    return subFromHits(slot, withKey.facetKey, planSlot.preresolvedHits);
  }

  const { retrieval, cacheHit } = await retrieveKmWithHitsCache({
    corpusUserId: state.context.corpusUserId,
    slot: withKey,
  });
  return subFromHits(slot, withKey.facetKey, {
    hits: retrieval.hits,
    coverage: retrieval.coverage,
    notes: retrieval.notes,
    confidenceTier: retrieval.confidenceTier,
    confidenceScore: retrieval.confidenceScore,
    cacheHit,
  });
};

/** km 单槽：retrieve → FC →（可）局部重检 */
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
    let sub = await retrieveKmOne(state, slot);
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
      sub = await retrieveKmOne(state, refinedSlot, { liveRetrieve: true });
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
