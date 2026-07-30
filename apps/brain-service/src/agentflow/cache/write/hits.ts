import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import type { KnowledgeRetrievalResult } from "@/agentflow/agents/online/knowledge-manager/contract/types";
import { setRetrievalCache } from "@fambrain/infra";

const buildHitsCacheKey = (
    corpusUserId: string,
    slot: CompositeRetrievalSlot
) => ({
    corpusUserId,
    searchQuery: slot.searchQuery,
    queryType: slot.queryType,
});

/** hits 槽缓存写入（live retrieve 之后；失败不阻断主链） */
export const writeHitsCache = async (input: {
    corpusUserId: string;
    slot: CompositeRetrievalSlot;
    retrieval: KnowledgeRetrievalResult;
}): Promise<void> => {
    try {
        await setRetrievalCache(
            buildHitsCacheKey(input.corpusUserId, input.slot),
            {
                hits: input.retrieval.hits,
                coverage: input.retrieval.coverage,
                notes: input.retrieval.notes,
                confidenceTier: input.retrieval.confidenceTier,
                confidenceScore: input.retrieval.confidenceScore,
            }
        );
    } catch {
        /* 写入失败不阻断主链 */
    }
};
