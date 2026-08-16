import type {
  KnowledgeHit,
  KnowledgeRetrievalResult,
  QueryProfile,
} from "@/agentflow/agents/online/knowledge-manager";
import type {
  CompositeSlotId,
  IntakeRouteMode,
} from "@/agentflow/agents/online/intake-coordinator";
import type { CompositeSlotPlan } from "@/agentflow/cache";
import type { CompositeSessionKey } from "@fambrain/infra";
import type { Citation } from "@fambrain/brain-types";

export type { Citation };

/**
 * InformationAnalyst 输出；编排器将 answer 写入助手消息。
 */
export type InformationAnalystResult = {
  /** 面向用户的完整回答，Markdown _plain 文本即可 */
  answer: string;
  /** 文内结论对应的来源列表，至少在与履历/项目相关时提供 1 条 */
  citations: Citation[];
  /** 0–1，对回答可靠性的自评 */
  confidence: number;
  /**
   * 证据不足时为 true：须在 answer 中明确说明「知识库未覆盖」，
   * 且不得捏造用户经历。
   */
  insufficientEvidence: boolean;
  /** 结构化 UI 块（列举表格等）；Web 优先渲染 */
  blocks?: import("@fambrain/brain-types").AssistantMessageBlock[];
};

/** 编排器传入本 Agent 的上下文（写入 HumanMessage） */
export type InformationAnalystInput = {
  /** 用户本轮原始问题 */
  userQuestion: string;
  /** 入口接线员的路由信息（语言、子任务等） */
  language: "zh" | "en" | "mixed";
  subTasks: string[];
  /** 知识管理员产出；无检索时为空数组 */
  hits: KnowledgeHit[];
  coverage: KnowledgeRetrievalResult["coverage"];
  notes: string | null;
  /** Mem0 + LangMem；无则为 null */
  memoryBlock: string | null;
  /** skip / slots / list / dag */
  routeMode?: IntakeRouteMode;
  /** qa | summarize | composite */
  composeMode?: import("@/agentflow/agents/online/intake-coordinator/path-plan").ComposeMode;
  /** 分槽检索结果；slots 路由时有值（length ≥ 1） */
  compositeSubResults?: Array<{
    slot: CompositeSlotId;
    facetKey?: string;
    label: string;
    hits: KnowledgeHit[];
    coverage: KnowledgeRetrievalResult["coverage"];
    notes?: string | null;
    facetAnswerCacheHit?: boolean;
    enumerationMeta?: import("@/agentflow/agents/online/knowledge-manager").EnumerationMeta;
    /** mem 槽召回 */
    recalledFact?: {
      factKey: string;
      label: string;
      value: string | null;
    } | null;
    dataSource?: string | null;
    /** HITL / vault 等工人直接挂载的 UI 块 */
    assistantBlocks?: import("@fambrain/brain-types").AssistantMessageBlock[];
  }>;
  /** composite 增量计划（含 槽答案缓存 命中标记） */
  compositeIncrementalPlan?: {
    slots: CompositeSlotPlan[];
    facetCacheHits: number;
  };
  /** 槽答案会话缓存 写入键 */
  sessionKey?: CompositeSessionKey;
  /** Intake queryType（QU-05/06 单一意图来源） */
  queryType?: QueryProfile | null;
  /** 检索用 searchQuery（profile 解析兜底） */
  searchQuery?: string;
  /** Intake topics（项目/经历列举分流） */
  topics?: string[];
  /** KM 列举元数据（分页 total/shown/page） */
  enumerationMeta?:
    | import("@/agentflow/agents/online/knowledge-manager").EnumerationMeta
    | null;
  /** 列举分页意图（preview / exhaustive / continue） */
  listIntent?:
    | import("@/agentflow/agents/online/intake-coordinator").EnumerationListIntent
    | null;
  /** prepareTurnStart 注入的计算基准日 */
  asOfDate?: string;
  /** ToolOrchestrator / DagExecutor 预计算（年龄、列举、联网等） */
  toolResults?:
    | import("@/agentflow/agents/online/tool-orchestrator/interface").PipelineToolResults
    | null;
};
