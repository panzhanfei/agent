/**
 * composite 缓存计划：进 fan-out / list 前一次性 resolve。
 * - facet 会话缓存：全槽查 snapshot.facets[facetKey]
 * - hits 检索缓存：km 槽且 facet 未命中时预查 getRetrievalFromCache
 */
import {
    getCompositeSession,
    isFacetAnswerReusable,
    type CompositeSessionKey,
} from "@fambrain/infra";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import { attachFacetKey, facetAnswerMatchesSlot } from "./facet-key";
import { lookupHitsCache } from "./slot-hits";
import type { CompositeCachePlan, CompositeSlotPlan } from "./interface";

const isKmExecutor = (slot: CompositeRetrievalSlot): boolean =>
    !slot.executor || slot.executor === "km_retrieve";

export type ResolveCompositeCachePlanInput = {
    session: CompositeSessionKey;
    userQuestion: string;
    slots: CompositeRetrievalSlot[];
    corpusUserId: string;
    /** 纯 list 路径可关；planFanOut 默认 true */
    prefetchHits?: boolean;
};

export const resolveCompositeCachePlan = async (
    input: ResolveCompositeCachePlanInput
): Promise<CompositeCachePlan> => {
    const sessionCleared = false;
    void input.userQuestion;
    const prefetchHits = input.prefetchHits ?? true;

    const snapshot = await getCompositeSession(input.session);

    const slots: CompositeSlotPlan[] = [];
    const slotPlanById: Record<string, CompositeSlotPlan> = {};
    const activeRetrievalSlots: CompositeRetrievalSlot[] = [];
    let facetCacheHits = 0;
    let hitsCacheHits = 0;

    for (const slot of input.slots) {
        const withKey = attachFacetKey(slot);
        const cached = snapshot?.facets[withKey.facetKey] ?? null;
        const useCachedAnswer =
            isFacetAnswerReusable(cached) &&
            facetAnswerMatchesSlot(cached, withKey);
        if (useCachedAnswer) facetCacheHits++;

        let preresolvedHits = null;
        if (
            prefetchHits &&
            !useCachedAnswer &&
            isKmExecutor(slot)
        ) {
            preresolvedHits = await lookupHitsCache({
                corpusUserId: input.corpusUserId,
                slot: withKey,
            });
            if (preresolvedHits?.cacheHit) hitsCacheHits++;
        }

        const plan: CompositeSlotPlan = {
            ...withKey,
            useCachedAnswer,
            cachedAnswer: useCachedAnswer ? cached : null,
            preresolvedHits,
        };
        slots.push(plan);
        slotPlanById[String(slot.id)] = plan;
        if (!useCachedAnswer && slot.executor !== "list_corpus") {
            activeRetrievalSlots.push(slot);
        }
    }

    return {
        slots,
        slotPlanById,
        activeRetrievalSlots,
        facetCacheHits,
        hitsCacheHits,
        sessionCleared,
    };
};

/** @deprecated 别名；list / verify 等仍可用，默认不预查 hits */
export const resolveIncrementalCompositePlan = async (input: {
    session: CompositeSessionKey;
    userQuestion: string;
    slots: CompositeRetrievalSlot[];
    corpusUserId?: string;
    prefetchHits?: boolean;
}): Promise<CompositeCachePlan> =>
    resolveCompositeCachePlan({
        session: input.session,
        userQuestion: input.userQuestion,
        slots: input.slots,
        corpusUserId: input.corpusUserId ?? "",
        prefetchHits: input.prefetchHits ?? false,
    });
