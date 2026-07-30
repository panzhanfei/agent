import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import { getRetrievalFromCache } from "@fambrain/infra";
import type { PreresolvedSlotHits } from "../interface";

const buildHitsCacheKey = (
    corpusUserId: string,
    slot: CompositeRetrievalSlot
) => ({
    corpusUserId,
    searchQuery: slot.searchQuery,
    queryType: slot.queryType,
});

const payloadToPreresolved = (
    payload: NonNullable<Awaited<ReturnType<typeof getRetrievalFromCache>>>
): PreresolvedSlotHits => ({
    hits: payload.hits,
    coverage: payload.coverage,
    notes: payload.notes,
    confidenceTier: payload.confidenceTier,
    confidenceScore: payload.confidenceScore,
    cacheHit: true,
});

/** 只读 hits 缓存（仅 planCacheResolve 调用） */
export const lookupHitsCache = async (input: {
    corpusUserId: string;
    slot: CompositeRetrievalSlot;
}): Promise<PreresolvedSlotHits | null> => {
    const cached = await getRetrievalFromCache(
        buildHitsCacheKey(input.corpusUserId, input.slot)
    );
    if (!cached) return null;
    return payloadToPreresolved(cached);
};
