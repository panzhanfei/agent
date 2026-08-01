import type { AssistantMessageBlock } from "@fambrain/brain-types";
import type { QueryProfile } from "@/agentflow/agents/online/knowledge-manager";
import type { Citation } from "@/agentflow/agents/online/information-analyst/prompt";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";

/**
 * 数据源（细语义）：
 * - corpus / compute：语料检索或 hits 后计算
 * - web：外网独立工具
 * - synthesize：DAG 汇合
 * - mem0：用户自述记忆召回
 * - user_text：用户粘贴/原文总结
 */
export type DataSource =
    | "corpus"
    | "web"
    | "compute"
    | "synthesize"
    | "mem0"
    | "user_text";

/**
 * 工具白名单。扩展天气/搜索等：在此加 id + execute switch；
 * 不在 POST_RETRIEVAL_TOOL_IDS 内的 → 自动走 toolRetrieve Send。
 */
export const TOOL_RUN_IDS = [
    "retrieve_corpus",
    "list_corpus_entries",
    "compute_age_from_hits",
    "compute_tenure_from_hits",
    "extract_identity_from_hits",
    "extract_external_links_from_hits",
    "compose_enumeration",
    "search_web",
    "synthesize_merge",
] as const;

export type ToolRunId = (typeof TOOL_RUN_IDS)[number];

/**
 * 需先有 corpus/list hits 再跑的工具（planSlotPost）。
 * 其它 toolId → 独立 toolRetrieve 工人（架构上易加天气/搜索等）。
 */
export const POST_RETRIEVAL_TOOL_IDS = [
    "retrieve_corpus",
    "list_corpus_entries",
    "compute_age_from_hits",
    "compute_tenure_from_hits",
    "extract_identity_from_hits",
    "extract_external_links_from_hits",
    "compose_enumeration",
] as const;

export type PostRetrievalToolId = (typeof POST_RETRIEVAL_TOOL_IDS)[number];

export const isPostRetrievalToolId = (
    toolId: ToolRunId | null | undefined
): toolId is PostRetrievalToolId =>
    Boolean(
        toolId &&
            (POST_RETRIEVAL_TOOL_IDS as readonly string[]).includes(toolId)
    );

/** 独立工具步默认 dataSource（按 toolId；未列出则 web） */
export const defaultDataSourceForStandaloneTool = (
    toolId: ToolRunId
): DataSource => {
    if (toolId === "synthesize_merge") return "synthesize";
    if (
        toolId === "retrieve_corpus" ||
        toolId === "list_corpus_entries" ||
        toolId === "compose_enumeration"
    ) {
        return "corpus";
    }
    if (
        toolId === "compute_age_from_hits" ||
        toolId === "compute_tenure_from_hits"
    ) {
        return "compute";
    }
    return "web";
};

export type ToolRunResult = {
    toolId: ToolRunId;
    label: string;
    ok: boolean;
    answer: string;
    citations: Citation[];
    hits: KnowledgeHit[];
    blocks?: AssistantMessageBlock[];
    insufficientEvidence: boolean;
    confidence: number;
    webSnippets?: Array<{ title: string; url: string; snippet: string }>;
    /** DAG 执行期裁剪：结构化 skip（非口语规则） */
    skipped?: boolean;
    skipReason?: "deps" | "timeout" | "budget" | "cancelled";
};

export type ExecutionPlanNode = {
    id: string;
    label: string;
    dataSource: DataSource;
    toolId: ToolRunId;
    searchQuery?: string;
    webQuery?: string;
    queryType?: QueryProfile;
    topics?: string[];
    /** identity 字段 id（来自 field-catalog，非用户口语硬编码） */
    field?: string | null;
    deps: string[];
    /** composite 槽位执行时覆盖 state.hits */
    hitsOverride?: KnowledgeHit[];
    /** composite 列举槽的 KM 元数据 */
    enumerationMetaOverride?: import("@/agentflow/agents/online/knowledge-manager").EnumerationMeta | null;
};

export type EnrichedPlanItem = {
    label: string;
    searchQuery: string;
    queryType: QueryProfile;
    topics: string[];
    dataSource: DataSource;
    field: string | null;
    toolId: ToolRunId | null;
};

export type PipelineToolResults = Record<string, ToolRunResult>;
