import type { CachedFacetAnswer } from "@fambrain/infra";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import type {
    ConfidenceTier,
    KnowledgeHit,
    KnowledgeRetrievalResult,
} from "@/agentflow/agents/online/knowledge-manager/contract/types";

/** 单槽 plan：facet 会话缓存 + 可选 hits 预查结果 */
export type CompositeSlotPlan = CompositeRetrievalSlot & {
    facetKey: string;
    useCachedAnswer: boolean;
    cachedAnswer: CachedFacetAnswer | null;
    /** planCacheResolve 预查 hits；KM worker 只读，FC 重试用 live retrieve */
    preresolvedHits: PreresolvedSlotHits | null;
};

/** hits 缓存预查载荷（进 KM 前 resolve） */
export type PreresolvedSlotHits = {
    hits: KnowledgeHit[];
    coverage: KnowledgeRetrievalResult["coverage"];
    notes: string | null;
    confidenceTier?: ConfidenceTier;
    confidenceScore?: number;
    cacheHit: boolean;
};

/**
 * composite 缓存计划（facet 全槽 + km 槽 hits 预查）。
 * - slots：全部槽（含命中/未命中标记）
 * - slotPlanById：worker 按 activeSlotId O(1) 读取
 * - activeRetrievalSlots：facet 未命中且非 list_corpus 的槽
 */
export type CompositeCachePlan = {
    slots: CompositeSlotPlan[];
    slotPlanById: Record<string, CompositeSlotPlan>;
    activeRetrievalSlots: CompositeRetrievalSlot[];
    facetCacheHits: number;
    hitsCacheHits: number;
    sessionCleared: boolean;
};

/** @deprecated 别名；state / join 字段名保留 */
export type IncrementalCompositePlan = CompositeCachePlan;
