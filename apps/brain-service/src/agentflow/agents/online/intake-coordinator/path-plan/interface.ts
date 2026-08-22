/**
 * PathPlan：Intake 有序执行计划（单一 steps[]）。
 *
 * kind = LangGraph Send 工人族（粗）；dataSource / toolId / userFactKey = 细语义。
 * 数组顺序 = 回答/执行顺序。
 */
import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import type { EnumerationControl } from "@/agentflow/agents/online/corpus-lister/enumeration";
import type {
  ConfidenceTier,
  EnumerationMeta,
  KnowledgeHit,
  KnowledgeRetrievalResult,
} from "@/agentflow/agents/online/knowledge-manager";
import type {
  DataSource,
  ToolRunId,
  ToolRunResult,
} from "@/agentflow/agents/online/tool-orchestrator";

/** Send 工人族：km | list | mem | tool | summarize | dag | vault_workspace */
export type PathKind =
  | "km"
  | "list"
  | "mem"
  | "tool"
  | "summarize"
  | "dag"
  | "vault_workspace";

export type ComposeMode = "qa" | "summarize" | "composite";

/** synthesize_merge 输出契约：free=按 goal 汇合；match_report=固定四栏对照（须 Intake 显式声明） */
export type SynthesizeSchema = "free" | "match_report";

/** 空证据策略：require | omit | degrade */
export type EmptyPolicy = "require" | "omit" | "degrade";

/**
 * DAG 内节点（有向依赖图）。toolId 白名单；边 = deps / optionalDeps。
 * 不是业务场景名，禁止用 template 展开固定图。
 */
export type DagNodeSpec = {
  id: string;
  label: string;
  toolId: ToolRunId;
  searchQuery?: string;
  webQuery?: string;
  deps?: string[];
  optionalDeps?: string[];
  emptyPolicy?: EmptyPolicy;
  dataSource?: DataSource | null;
  queryType?:
    | "identity"
    | "enumeration"
    | "tech"
    | "external_link"
    | "relations"
    | "default";
  topics?: string[];
  targetLang?: string | null;
  sourceLang?: string | null;
  synthesizeSchema?: SynthesizeSchema;
};

/**
 * 单步执行计划（LLM 终稿字段）。
 * - km：向量/混合检索；可挂 post-tool（age/links/identity）
 * - list：目录扫盘穷举/续页
 * - mem：Mem0 结构化召回（userFactKey + dataSource=mem0）
 * - tool：独立工具步（search_web / translate_text / get_weather 等）
 * - summarize：子步总结用户原文（dataSource=user_text）
 * - dag：有向依赖图（nodes[] + deps）；无固定业务 template
 * - vault_workspace：原文库 txt/文件夹（params.operation=list|open|create_*|update|delete_*；list 可无 path）。独占单槽，不与 km/list/mem/tool/dag/summarize 同 plan
 */
export type ExecutionStep = {
  id: string;
  kind: PathKind;
  /** 面向用户的子问题标题 */
  label: string;
  /**
   * 空证据策略（缺省 degrade）。
   * require=必须有答案；omit=可省略；degrade=带缺口继续。
   */
  emptyPolicy?: EmptyPolicy;
  /**
   * km/list/tool：检索/工具查询词；summarize：待总结正文；
   * vault_workspace：可作 targetPath 回退（优先 params.targetPath；list 根用 ""）
   */
  searchQuery: string;
  queryType: "identity" | "enumeration" | "tech" | "external_link" | "relations" | "default";
  topics: string[];
  identityField?: IntakeIdentityField | null;
  /** 检索后或独立工具（白名单 ToolRunId） */
  toolId?: ToolRunId | null;
  dataSource?: DataSource | null;
  /** translate_text：目标语码（如 en / zh） */
  targetLang?: string | null;
  /** translate_text：源语码，默认 auto */
  sourceLang?: string | null;
  /** mem 步：用户自述字段 slug（开集，由 Intake 命名） */
  userFactKey?: string | null;
  /** mem 步：展示名 */
  userFactLabel?: string | null;
  /** 仅 list */
  enumerationControl?: EnumerationControl | null;
  enumerationPage?: number;
  enumerationPageSize?: number;
  /** 仅 dag：内嵌有向节点（须 ≥1；无 nodes 则合法化丢弃该步） */
  nodes?: DagNodeSpec[];
  deps?: string[];
  params?: Record<string, unknown>;
};

/** 与 Intake `language` 对齐 */
export type ReplyLanguage = "zh" | "en" | "mixed";

export type LegalizePathPlanOptions = {
  /** 本轮回复语；translate_text 缺 targetLang 时按此补（en→en，其余→zh） */
  replyLanguage?: ReplyLanguage;
};

export type PathPlan = {
  /** 有序执行步；顺序即回答顺序 */
  steps: ExecutionStep[];
};

export type PathPlanCounts = {
  km: number;
  list: number;
  mem: number;
  tool: number;
  summarize: number;
  dag: number;
  vault_workspace: number;
  total: number;
};

export type StepResult = {
  stepId: string;
  pathKind: PathKind;
  label: string;
  hits: KnowledgeHit[];
  coverage: KnowledgeRetrievalResult["coverage"];
  notes: string | null;
  confidenceTier?: ConfidenceTier | null;
  enumerationMeta?: EnumerationMeta | null;
  toolOutput?: ToolRunResult | null;
  cacheHit?: boolean;
  facetKey?: string;
};
