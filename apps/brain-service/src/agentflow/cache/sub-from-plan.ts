import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager/composite/interface";
import type { CompositeSlotPlan, PreresolvedSlotHits } from "./interface";

/** facet 会话缓存命中 → CompositeSubRetrieval */
export const subFromFacetCache = (
    slot: CompositeRetrievalSlot,
    plan: CompositeSlotPlan
): CompositeSubRetrieval => ({
    slot: slot.id,
    facetKey: plan.facetKey,
    label: slot.label,
    hits: plan.cachedAnswer!.citations.map((c, i) => ({
        path: c.path,
        title: c.path.split("/").pop() ?? c.path,
        excerpt: c.excerpt,
        relevance: Math.max(0.5, 1 - i * 0.05),
    })),
    coverage: plan.cachedAnswer!.coverage,
    notes: null,
    cacheHit: true,
    facetAnswerCacheHit: true,
});

/** hits 预查或 live 检索 → CompositeSubRetrieval */
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

export const findSlotCachePlan = (
    plan: { slots: CompositeSlotPlan[]; slotPlanById: Record<string, CompositeSlotPlan> } | null | undefined,
    slotId: string | number
): CompositeSlotPlan | null =>
    plan?.slotPlanById[String(slotId)] ??
    plan?.slots.find((s) => String(s.id) === String(slotId)) ??
    null;
