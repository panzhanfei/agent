import type { CachedFacetAnswer } from "@fambrain/infra";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager/composite/interface";
import type { KnowledgeRetrievalResult } from "@/agentflow/agents/online/knowledge-manager/contract/types";
import type { PreresolvedSlotHits } from "../interface";

/** facet 会话缓存 → CompositeSubRetrieval */
export const subFromFacetCache = (
    slot: CompositeRetrievalSlot,
    facetKey: string,
    cachedAnswer: CachedFacetAnswer
): CompositeSubRetrieval => ({
    slot: slot.id,
    facetKey,
    label: slot.label,
    hits: cachedAnswer.citations.map((c, i) => ({
        path: c.path,
        title: c.path.split("/").pop() ?? c.path,
        excerpt: c.excerpt,
        relevance: Math.max(0.5, 1 - i * 0.05),
    })),
    coverage: cachedAnswer.coverage,
    notes: null,
    cacheHit: true,
    facetAnswerCacheHit: true,
});

/** hits 缓存或 live 检索 → CompositeSubRetrieval */
export const subFromHits = (
    slot: CompositeRetrievalSlot,
    facetKey: string,
    hits: PreresolvedSlotHits
): CompositeSubRetrieval => ({
    slot: slot.id,
    facetKey,
    label: slot.label,
    hits: hits.hits,
    coverage: hits.coverage,
    notes: hits.notes,
    confidenceTier: hits.confidenceTier,
    cacheHit: hits.cacheHit,
    facetAnswerCacheHit: false,
});

export const subFromRetrieval = (
    slot: CompositeRetrievalSlot,
    facetKey: string,
    retrieval: KnowledgeRetrievalResult,
    cacheHit: boolean
): CompositeSubRetrieval =>
    subFromHits(slot, facetKey, {
        hits: retrieval.hits,
        coverage: retrieval.coverage,
        notes: retrieval.notes,
        confidenceTier: retrieval.confidenceTier,
        confidenceScore: retrieval.confidenceScore,
        cacheHit,
    });

/** resolve 阶段：facet / hits 命中时拼 resolvedSub */
export const buildResolvedSub = (
    slot: CompositeRetrievalSlot,
    input: {
        facetKey: string;
        useCachedAnswer: boolean;
        cachedAnswer: CachedFacetAnswer | null;
        preresolvedHits: PreresolvedSlotHits | null;
    }
): CompositeSubRetrieval | null => {
    if (input.useCachedAnswer && input.cachedAnswer) {
        return subFromFacetCache(slot, input.facetKey, input.cachedAnswer);
    }
    if (input.preresolvedHits) {
        return subFromHits(slot, input.facetKey, input.preresolvedHits);
    }
    return null;
};

export const findSlotCachePlan = (
    plan: {
        slots: { id: string | number; resolvedSub?: CompositeSubRetrieval | null }[];
        slotPlanById: Record<
            string,
            { resolvedSub?: CompositeSubRetrieval | null }
        >;
    } | null | undefined,
    slotId: string | number
): { resolvedSub: CompositeSubRetrieval | null } | null => {
    const entry =
        plan?.slotPlanById[String(slotId)] ??
        plan?.slots.find((s) => String(s.id) === String(slotId)) ??
        null;
    if (!entry) return null;
    return { resolvedSub: entry.resolvedSub ?? null };
};
