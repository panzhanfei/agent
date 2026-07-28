/**
 * 单槽 retrieve + FC +（失败且有 refinedQuery 时）局部重检一次。
 * 供 kmRetrieve / listRetrieve 每槽 Send 工人复用。
 */
import {
  attachFacetKey,
  resolveIncrementalCompositePlan,
  retrieveSlotWithCache,
  type CompositeSubRetrieval,
} from "@/agentflow/agents/online/knowledge-manager";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import { fetchListSlot } from "@/agentflow/agents/online/corpus-lister";
import {
  checkStepFacts,
  subToStepResult,
} from "@/agentflow/agents/online/fact-checker";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PlanSlotWorkerPatch } from "./interface";

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
  pathKind: "km" | "list",
  notes: string
): StepResult => ({
  stepId: slotId,
  pathKind,
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

const retrieveKmOne = async (
  state: PipelineGraphState,
  slot: CompositeRetrievalSlot
): Promise<CompositeSubRetrieval> => {
  const sessionKey = {
    conversationId: state.context.conversationId,
    corpusUserId: state.context.corpusUserId,
  };
  const allSlots = state.decision?.compositeSlots ?? [slot];
  const incremental = await resolveIncrementalCompositePlan({
    session: sessionKey,
    userQuestion: state.userQuestion,
    slots: allSlots,
  });
  const planSlot = incremental.slots.find(
    (s) => String(s.id) === String(slot.id)
  );
  if (planSlot?.useCachedAnswer && planSlot.cachedAnswer) {
    return {
      slot: slot.id,
      facetKey: planSlot.facetKey,
      label: slot.label,
      hits: planSlot.cachedAnswer.citations.map((c, i) => ({
        path: c.path,
        title: c.path.split("/").pop() ?? c.path,
        excerpt: c.excerpt,
        relevance: Math.max(0.5, 1 - i * 0.05),
      })),
      coverage: planSlot.cachedAnswer.coverage,
      notes: null,
      cacheHit: true,
      facetAnswerCacheHit: true,
    };
  }

  const withKey = attachFacetKey(slot);
  const { retrieval, cacheHit } = await retrieveSlotWithCache({
    corpusUserId: state.context.corpusUserId,
    slot: withKey,
  });
  return {
    slot: slot.id,
    facetKey: withKey.facetKey,
    label: slot.label,
    hits: retrieval.hits,
    coverage: retrieval.coverage,
    notes: retrieval.notes,
    confidenceTier: retrieval.confidenceTier,
    enumerationMeta: retrieval.enumerationMeta,
    cacheHit,
    facetAnswerCacheHit: false,
  };
};

const runFcAndMaybeRetry = async (input: {
  state: PipelineGraphState;
  slot: CompositeRetrievalSlot;
  executor: "km" | "list";
  sub: CompositeSubRetrieval;
}): Promise<{ sub: CompositeSubRetrieval; step: StepResult; retried: boolean }> => {
  const { state, slot, executor } = input;
  let sub = input.sub;
  let retried = false;

  let fc = await checkStepFacts({
    userQuestion: state.userQuestion,
    decision: state.decision!,
    sub,
    retryCount: state.retryCount,
    retrievalCacheHit: Boolean(sub.cacheHit),
  });

  if (
    !fc.passed &&
    fc.refinedSearchQuery &&
    state.retryCount < 1 &&
    executor === "km"
  ) {
    const refinedSlot: CompositeRetrievalSlot = {
      ...slot,
      searchQuery: fc.refinedSearchQuery,
    };
    sub = await retrieveKmOne(state, refinedSlot);
    retried = true;
    fc = await checkStepFacts({
      userQuestion: state.userQuestion,
      decision: state.decision!,
      sub,
      retryCount: state.retryCount + 1,
      retrievalCacheHit: Boolean(sub.cacheHit),
    });
  }

  const step = subToStepResult(sub, fc, executor === "list" ? "list" : "km");
  return { sub, step, retried };
};

export const resolveActiveSlot = (
  state: PipelineGraphState
): CompositeRetrievalSlot | null => {
  const id = state.activeSlotId?.trim();
  if (!id || !state.decision) return null;
  return (
    state.decision.compositeSlots.find((s) => String(s.id) === id) ?? null
  );
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
      stepResult: failedStep(slotId, "unknown", "km", "缺少 activeSlotId"),
      error: "缺少 activeSlotId",
    };
  }

  try {
    const sub0 = await retrieveKmOne(state, slot);
    const { sub, step, retried } = await runFcAndMaybeRetry({
      state,
      slot,
      executor: "km",
      sub: sub0,
    });
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
      stepResult: failedStep(String(slot.id), slot.label, "km", msg),
      error: msg,
    };
  }
};

/** list 单槽：fetchListSlot → FC */
export const runListSlotWorker = async (
  state: PipelineGraphState
): Promise<PlanSlotWorkerPatch> => {
  const slot = resolveActiveSlot(state);
  const slotId = state.activeSlotId ?? "unknown";
  if (!slot) {
    return {
      slotId,
      executor: "list",
      sub: emptySub(slotId, "unknown", "缺少 activeSlotId"),
      stepResult: failedStep(slotId, "unknown", "list", "缺少 activeSlotId"),
      error: "缺少 activeSlotId",
    };
  }

  try {
    const sub0 = await fetchListSlot(
      slot,
      state.context.corpusUserId,
      state.asOfDate ?? null
    );
    const { sub, step, retried } = await runFcAndMaybeRetry({
      state,
      slot,
      executor: "list",
      sub: sub0,
    });
    return {
      slotId: String(slot.id),
      executor: "list",
      sub,
      stepResult: step,
      error: null,
      retried,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "list 单槽检索失败";
    const sub = emptySub(String(slot.id), slot.label, msg);
    return {
      slotId: String(slot.id),
      executor: "list",
      sub,
      stepResult: failedStep(String(slot.id), slot.label, "list", msg),
      error: msg,
    };
  }
};
