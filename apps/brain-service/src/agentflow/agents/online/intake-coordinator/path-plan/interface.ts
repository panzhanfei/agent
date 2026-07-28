/**
 * PathPlan：Intake 有序执行计划（单一 steps[]；不再用四桶 + answerOrder 拼凑）。
 *
 * kind = 执行器类型（km | list | tool | dag），不是业务场景名。
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

export type PathKind = "km" | "list" | "tool" | "dag";

export type ComposeMode = "qa" | "summarize" | "composite";

/** 仅通用多源汇合；禁止为单业务场景再加 named template */
export type DagTemplateId = "hybrid_multi_source";

/**
 * 单步执行计划（LLM 终稿字段）。
 * - km：向量/混合检索；可挂 post-tool（age/links/identity）
 * - list：目录扫盘穷举/续页
 * - tool：独立工具步（如 search_web）
 * - dag：仅 hybrid_multi_source（语料+外网汇合）
 */
export type ExecutionStep = {
  id: string;
  kind: PathKind;
  /** 面向用户的子问题标题 */
  label: string;
  /** LLM 改写后的检索/工具查询词 */
  searchQuery: string;
  queryType: "identity" | "enumeration" | "tech" | "external_link" | "default";
  topics: string[];
  identityField?: IntakeIdentityField | null;
  /** 检索后或独立工具（白名单 ToolRunId） */
  toolId?: ToolRunId | null;
  dataSource?: DataSource | null;
  /** 仅 list */
  enumerationControl?: EnumerationControl | null;
  enumerationPage?: number;
  enumerationPageSize?: number;
  /** 仅 dag */
  template?: DagTemplateId;
  deps?: string[];
  params?: Record<string, unknown>;
};

/** @deprecated 兼容别名；新代码用 ExecutionStep */
export type PathStepBase = Omit<ExecutionStep, "kind"> & { pathKind?: PathKind };
/** @deprecated */
export type KmStep = ExecutionStep & { kind: "km" };
/** @deprecated */
export type ListStep = ExecutionStep & { kind: "list" };
/** @deprecated */
export type ToolStep = ExecutionStep & { kind: "tool"; toolId: ToolRunId; dataSource: DataSource };
/** @deprecated */
export type DagRun = ExecutionStep & {
  kind: "dag";
  template: DagTemplateId;
};

export type PathPlan = {
  /** 有序执行步；顺序即回答顺序 */
  steps: ExecutionStep[];
};

export type PathPlanCounts = {
  km: number;
  list: number;
  tool: number;
  dag: number;
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
