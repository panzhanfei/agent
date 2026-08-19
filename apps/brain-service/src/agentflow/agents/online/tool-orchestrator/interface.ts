import type { AssistantMessageBlock } from "@fambrain/brain-types";
import type { QueryProfile } from "@/agentflow/agents/online/knowledge-manager";
import type { Citation } from "@/agentflow/agents/online/information-analyst/interface";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";
import type {
    PostRetrievalToolId,
    ToolRunId,
} from "@/agentflow/tools/catalog/interface";

export type { PostRetrievalToolId, ToolRunId } from "@/agentflow/tools/catalog/interface";
export {
    isPostRetrievalToolId,
    POST_RETRIEVAL_TOOL_IDS,
    TOOL_RUN_IDS,
} from "@/agentflow/tools/catalog";

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
    /** synthesize_merge：匹配结构化报告（L2）；answer 为其 L1 Markdown 渲染 */
    matchReport?: import("@/agentflow/tools/synthesize/interface").MatchReport;
};

export type ExecutionPlanNode = {
    id: string;
    label: string;
    dataSource: DataSource;
    toolId: ToolRunId;
    searchQuery?: string;
    webQuery?: string;
    /** translate_text：目标语（结构化；非法由工具层拒绝） */
    targetLang?: string | null;
    /** translate_text：源语，默认 auto */
    sourceLang?: string | null;
    queryType?: QueryProfile;
    topics?: string[];
    /** identity 字段 id（来自 field-catalog，非用户口语硬编码） */
    field?: string | null;
    deps: string[];
    /**
     * soft 依赖：未满足时不阻断本节点（动态裁剪）；
     * 仍写入结果 notes / degraded。未列出的 dep 视为 hard。
     */
    optionalDeps?: string[];
    /**
     * 空证据策略：require / omit / degrade（缺省 degrade）。
     * 与 pathPlan.emptyPolicy 同语义。
     */
    emptyPolicy?: import("@/agentflow/agents/online/intake-coordinator/path-plan").EmptyPolicy;
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
