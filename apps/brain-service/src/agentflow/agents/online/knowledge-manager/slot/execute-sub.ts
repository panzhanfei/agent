/**
 * km 单槽主逻辑：消费 plan.resolvedSub，或 retrieveKnowledge + hits 写入。
 * 查缓存 / 预拼 sub 在 planCacheResolve（agentflow/cache/read）。
 */
import {
    attachFacetKey,
    findSlotCachePlan,
    subFromRetrieval,
    writeHitsCache,
} from "@/agentflow/cache";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import type { CompositeSubRetrieval } from "../composite/interface";
import { retrieveKnowledge } from "@/agentflow/agents/online/knowledge-manager/recall";
import type { ExecuteKmSlotSubInput } from "./interface";

export type { ExecuteKmSlotSubInput } from "./interface";

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
        identityField: input.slot.identityField,
        listKind: input.slot.enumerationControl?.listKind ?? null,
        candidates: [],
    });
    await writeHitsCache({
        corpusUserId: input.corpusUserId,
        slot: withKey,
        retrieval,
    });
    return subFromRetrieval(input.slot, withKey.facetKey, retrieval, false);
};
