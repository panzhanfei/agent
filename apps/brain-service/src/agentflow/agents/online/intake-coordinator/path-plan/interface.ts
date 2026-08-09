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
import type { FactCheckerIssue } from "@/agentflow/agents/online/fact-checker";
import type {
  DataSource,
  ToolRunId,
  ToolRunResult,
} from "@/agentflow/agents/online/tool-orchestrator";

/** Send 工人族：km | list | mem | tool | summarize | dag | corpus_edit */
export type PathKind =
  | "km"
  | "list"
  | "mem"
  | "tool"
  | "summarize"
  | "dag"
  | "corpus_edit";

export type ComposeMode = "qa" | "summarize" | "composite";

/** 仅通用多源汇合；禁止为单业务场景再加 named template */
export type DagTemplateId = "hybrid_multi_source";

/**
 * 单步执行计划（LLM 终稿字段）。
 * - km：向量/混合检索；可挂 post-tool（age/links/identity）
 * - list：目录扫盘穷举/续页
 * - mem：Mem0 结构化召回（userFactKey + dataSource=mem0）
 * - tool：独立工具步（search_web 等；扩展天气/搜索同族）
 * - summarize：子步总结用户原文（dataSource=user_text）
 * - dag：仅 hybrid_multi_source（语料+外网汇合）
 * - corpus_edit：HITL 语料 md（params.targetPath / operation=update|clear|create|open / afterContent）
 */
export type ExecutionStep = {
  id: string;
  kind: PathKind;
  /** 面向用户的子问题标题 */
  label: string;
  /**
   * km/list/tool：检索/工具查询词；summarize：待总结正文；
   * corpus_edit：可作 targetPath 回退（优先 params.targetPath）
   */
  searchQuery: string;
  queryType: "identity" | "enumeration" | "tech" | "external_link" | "default";
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
  /** 仅 dag */
  template?: DagTemplateId;
  deps?: string[];
  params?: Record<string, unknown>;
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
  corpus_edit: number;
  total: number;
};

export type StepFactCheck = {
  passed: boolean;
  refinedSearchQuery?: string | null;
  issues?: FactCheckerIssue[];
  checkerNotes?: string | null;
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
  fc: StepFactCheck;
};
