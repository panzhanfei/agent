/**
 * 复合槽检索：按 executor 拆成 km / list，供图节点并行调用。
 * 合并规则与旧 runRetrievalNode 一致（按 compositeSlots 顺序）。
 */
import {
  mergeCompositeRetrieval,
  resolveIncrementalCompositePlan,
  retrieveCompositeIncremental,
  type CompositeSubRetrieval,
  type IncrementalCompositePlan,
} from "../composite";
import { fetchListSlot } from "@/agentflow/agents/online/corpus-lister/fetch-list-slot";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

export const splitCompositeSlotsByExecutor = (
  slots: CompositeRetrievalSlot[]
): {
  kmSlots: CompositeRetrievalSlot[];
  listSlots: CompositeRetrievalSlot[];
} => ({
  kmSlots: slots.filter((s) => s.executor !== "list_corpus"),
  listSlots: slots.filter((s) => s.executor === "list_corpus"),
});

export const orderSubResultsBySlots = (
  slots: CompositeRetrievalSlot[],
  parts: CompositeSubRetrieval[]
): CompositeSubRetrieval[] => {
  const byId = new Map<string, CompositeSubRetrieval>();
  for (const s of parts) {
    byId.set(String(s.slot), s);
  }
  return slots.map((slot, i) => {
    const found = byId.get(String(slot.id));
    if (found) return found;
    return {
      slot: slot.id,
      facetKey: `empty:${i}`,
      label: slot.label,
      hits: [],
      coverage: "none" as const,
      notes: null,
      cacheHit: false,
      facetAnswerCacheHit: false,
    };
  });
};

export type SlotRetrieveBundle = {
  subResults: CompositeSubRetrieval[];
  incremental: IncrementalCompositePlan | null;
  cacheHits: number;
  error?: string;
};

/** 仅 KM 槽（executor ≠ list_corpus） */
export const retrieveKmCompositeSlots = async (
  state: PipelineGraphState
): Promise<SlotRetrieveBundle> => {
  const slots = state.decision?.compositeSlots ?? [];
  const { kmSlots } = splitCompositeSlotsByExecutor(slots);
  if (kmSlots.length === 0) {
    return { subResults: [], incremental: null, cacheHits: 0 };
  }

  try {
    const sessionKey = {
      conversationId: state.context.conversationId,
      corpusUserId: state.context.corpusUserId,
    };
    // 增量计划按全量 slots 解析（facet cache 键一致）；只拉 km 槽
    const incremental = await resolveIncrementalCompositePlan({
      session: sessionKey,
      userQuestion: state.userQuestion,
      slots,
    });

    const kmFetched = await retrieveCompositeIncremental({
      corpusUserId: state.context.corpusUserId,
      plan: {
        ...incremental,
        slots: incremental.slots.filter((p) =>
          kmSlots.some((s) => String(s.id) === String(p.id))
        ),
        activeRetrievalSlots: incremental.activeRetrievalSlots.filter((p) =>
          kmSlots.some((s) => String(s.id) === String(p.id))
        ),
      },
    });

    return {
      subResults: kmFetched.subResults,
      incremental,
      cacheHits: kmFetched.cacheHits,
    };
  } catch (e) {
    return {
      subResults: [],
      incremental: null,
      cacheHits: 0,
      error: e instanceof Error ? e.message : "知识库检索失败",
    };
  }
};

/** 仅 list 槽（executor = list_corpus） */
export const retrieveListCompositeSlots = async (
  state: PipelineGraphState
): Promise<SlotRetrieveBundle> => {
  const slots = state.decision?.compositeSlots ?? [];
  const { listSlots } = splitCompositeSlotsByExecutor(slots);
  if (listSlots.length === 0) {
    return { subResults: [], incremental: null, cacheHits: 0 };
  }

  try {
    const listSubResults = await Promise.all(
      listSlots.map((slot) =>
        fetchListSlot(
          slot,
          state.context.corpusUserId,
          state.asOfDate ?? null
        )
      )
    );
    return {
      subResults: listSubResults,
      incremental: null,
      cacheHits: 0,
    };
  } catch (e) {
    return {
      subResults: [],
      incremental: null,
      cacheHits: 0,
      error: e instanceof Error ? e.message : "列举检索失败",
    };
  }
};

/** 按全量 slots 顺序合并 km+list 子结果，并做 hits merge */
export const mergeKmAndListRetrieveBundles = (
  slots: CompositeRetrievalSlot[],
  km: SlotRetrieveBundle,
  list: SlotRetrieveBundle
) => {
  const subResults = orderSubResultsBySlots(slots, [
    ...km.subResults,
    ...list.subResults,
  ]);
  const merged = mergeCompositeRetrieval(subResults);
  const enumerationMeta =
    subResults.find((s) => s.enumerationMeta)?.enumerationMeta ?? null;
  const incremental = km.incremental;
  const cacheHits = km.cacheHits;

  return {
    hits: merged.hits,
    coverage: merged.coverage,
    notes: merged.notes,
    confidenceTier: merged.confidenceTier,
    enumerationMeta,
    compositeSubResults: subResults,
    compositeIncrementalPlan: incremental,
    compositeFacetCacheHits: incremental?.facetCacheHits ?? 0,
    retrievalCacheSlotHits: cacheHits,
    retrievalCacheHit:
      Boolean(incremental) &&
      incremental!.activeRetrievalSlots.length > 0 &&
      cacheHits === incremental!.activeRetrievalSlots.length,
  };
};
