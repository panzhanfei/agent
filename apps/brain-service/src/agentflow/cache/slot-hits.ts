import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import { retrieveKnowledge } from "@/agentflow/agents/online/knowledge-manager/recall/retrieve";
import type { KnowledgeRetrievalResult } from "@/agentflow/agents/online/knowledge-manager/contract/types";
import {
    getRetrievalFromCache,
    setRetrievalCache,
} from "@fambrain/infra";
import type { PreresolvedSlotHits } from "./interface";

const buildHitsCacheKey = (
    corpusUserId: string,
    slot: CompositeRetrievalSlot
) => ({
    corpusUserId,
    searchQuery: slot.searchQuery,
    queryType: slot.queryType,
});

const payloadToPreresolved = (
    payload: NonNullable<Awaited<ReturnType<typeof getRetrievalFromCache>>>,
    cacheHit: boolean
): PreresolvedSlotHits => ({
    hits: payload.hits,
    coverage: payload.coverage,
    notes: payload.notes,
    confidenceTier: payload.confidenceTier,
    confidenceScore: payload.confidenceScore,
    cacheHit,
});

/** 只读 hits 缓存（planCacheResolve 预查） */
export const lookupHitsCache = async (input: {
    corpusUserId: string;
    slot: CompositeRetrievalSlot;
}): Promise<PreresolvedSlotHits | null> => {
    const cached = await getRetrievalFromCache(
        buildHitsCacheKey(input.corpusUserId, input.slot)
    );
    if (!cached) return null;
    return payloadToPreresolved(cached, true);
};

/** FC 重检等 live 路径：查缓存 → miss 则 retrieveKnowledge 并回写 */
export const retrieveKmWithHitsCache = async (input: {
    corpusUserId: string;
    slot: CompositeRetrievalSlot;
}): Promise<{ retrieval: KnowledgeRetrievalResult; cacheHit: boolean }> => {
    const cacheKey = buildHitsCacheKey(input.corpusUserId, input.slot);
    const cached = await getRetrievalFromCache(cacheKey);
    if (cached) {
        return {
            retrieval: {
                hits: cached.hits,
                coverage: cached.coverage,
                notes: cached.notes,
                confidenceTier: cached.confidenceTier,
                confidenceScore: cached.confidenceScore,
            },
            cacheHit: true,
        };
    }
    const retrieval = await retrieveKnowledge({
        corpusUserId: input.corpusUserId,
        searchQuery: input.slot.searchQuery,
        topics: input.slot.topics,
        subTasks: input.slot.subTasks,
        queryType: input.slot.queryType,
        candidates: [],
    });
    await setRetrievalCache(cacheKey, {
        hits: retrieval.hits,
        coverage: retrieval.coverage,
        notes: retrieval.notes,
        confidenceTier: retrieval.confidenceTier,
        confidenceScore: retrieval.confidenceScore,
    });
    return { retrieval, cacheHit: false };
};
