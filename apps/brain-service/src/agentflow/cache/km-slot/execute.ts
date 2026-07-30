import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import { retrieveKnowledge } from "@/agentflow/agents/online/knowledge-manager/recall/retrieve";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager/composite/interface";
import { attachFacetKey } from "../facet";
import type { CompositeCachePlan } from "../interface";
import { findSlotCachePlan, subFromRetrieval } from "../read/assemble-sub";
import { writeHitsCache } from "../write";

export type ExecuteKmSlotSubInput = {
    corpusUserId: string;
    plan: CompositeCachePlan | null;
    slot: CompositeRetrievalSlot;
    /** FC 重检：忽略 plan.resolvedSub，live retrieve + write */
    liveRetrieve?: boolean;
};

/**
 * km worker：有 plan.resolvedSub 则直接返回；否则 live retrieve + writeHits。
 * 查缓存与 sub 拼装均在 planCacheResolve（read/）完成。
 */
export const executeKmSlotSub = async (
    input: ExecuteKmSlotSubInput
): Promise<CompositeSubRetrieval> => {
    if (!input.liveRetrieve) {
        const cached = findSlotCachePlan(input.plan, input.slot.id);
        if (cached?.resolvedSub) {
            return cached.resolvedSub;
        }
    }

    const withKey = attachFacetKey(input.slot);
    const retrieval = await retrieveKnowledge({
        corpusUserId: input.corpusUserId,
        searchQuery: input.slot.searchQuery,
        topics: input.slot.topics,
        subTasks: input.slot.subTasks,
        queryType: input.slot.queryType,
        candidates: [],
    });
    await writeHitsCache({
        corpusUserId: input.corpusUserId,
        slot: withKey,
        retrieval,
    });
    return subFromRetrieval(input.slot, withKey.facetKey, retrieval, false);
};
