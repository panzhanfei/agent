import type {
    ConfidenceTier,
    EnumerationMeta,
    KnowledgeHit,
    KnowledgeRetrievalResult,
} from "@/agentflow/agents/online/knowledge-manager";

/** list 槽检索结果（与 fetchListSlot 输出对齐；planFanOut 混槽仍走 KM merge） */
export type ListSlotRetrieval = {
    hits: KnowledgeHit[];
    coverage: KnowledgeRetrievalResult["coverage"];
    notes: string | null;
    confidenceTier?: ConfidenceTier;
    enumerationMeta?: EnumerationMeta;
};

export type FlattenedListRetrieval = {
    hits: KnowledgeHit[];
    coverage: KnowledgeRetrievalResult["coverage"];
    notes: string | null;
    confidenceTier: ConfidenceTier | null;
    enumerationMeta: EnumerationMeta | null;
};
