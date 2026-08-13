/**
 * KM composite（执行侧）类型约定。
 */
import type {
    CompositeRetrievalSlot,
    CompositeSlotId,
} from "@/agentflow/agents/online/intake-coordinator";
import type {
    ConfidenceTier,
    EnumerationMeta,
    KnowledgeHit,
    KnowledgeRetrievalResult,
} from "../contract/interface";

/** Mem0 召回结果（mem 槽；非 corpus hits） */
export type RecalledUserFact = {
    factKey: string;
    label: string;
    value: string | null;
};

export type CompositeSubRetrieval = {
    slot: CompositeSlotId;
    /** facet 稳定键 */
    facetKey?: string;
    label: string;
    hits: KnowledgeHit[];
    coverage: KnowledgeRetrievalResult["coverage"];
    notes: string | null;
    confidenceTier?: ConfidenceTier;
    enumerationMeta?: EnumerationMeta;
    cacheHit: boolean;
    /** 槽答案缓存命中（跳过真检索 + Analyst） */
    facetAnswerCacheHit?: boolean;
    /** mem 槽召回；Analyst / fallback 优先于此 */
    recalledFact?: RecalledUserFact | null;
    /** 槽 dataSource（mem0 / user_text / corpus…） */
    dataSource?: string | null;
    /** HITL 等工人直接挂载的 UI 块（Analyst 透传，不经口语推断） */
    assistantBlocks?: import("@fambrain/brain-types").AssistantMessageBlock[];
};

export type CompositeRetrievePlan = {
    slots: CompositeRetrievalSlot[];
};
