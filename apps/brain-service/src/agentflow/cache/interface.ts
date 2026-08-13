import type { CachedFacetAnswer } from "@fambrain/infra";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import type {
    ConfidenceTier,
    KnowledgeHit,
    KnowledgeRetrievalResult,
} from "@/agentflow/agents/online/knowledge-manager/contract";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager/composite/interface";

/** 单槽 plan：facet 会话缓存 + resolve 阶段预拼 sub */
export type CompositeSlotPlan = CompositeRetrievalSlot & {
    facetKey: string;
    useCachedAnswer: boolean;
    cachedAnswer: CachedFacetAnswer | null;
    /** planCacheResolve 预拼；facet / hits 命中时有值 */
    resolvedSub: CompositeSubRetrieval | null;
    /** km worker 是否需 live retrieve */
    needsKmRetrieve: boolean;
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
