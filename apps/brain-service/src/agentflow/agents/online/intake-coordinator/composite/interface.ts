/**
 * Intake composite（规划侧）类型约定。
 */
import type {
  IntakeRetrievalPlanItem,
  IntakeRoutingDecision,
} from "@/agentflow/agents/online/intake-coordinator/contract";
import type { EnumerationControl, SlotExecutor } from "@/agentflow/agents/online/corpus-lister/enumeration";
import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import type {
  DataSource,
  ToolRunId,
} from "@/agentflow/agents/online/tool-orchestrator";
import type { EmptyPolicy } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";

/** identityField → 展示名 + 检索模板 */
export type IdentityFieldSearchSpec = {
  /** 无 LLM label 时的展示名（非口语匹配词表） */
  displayLabel: string;
  searchQuery: string;
};

/** 已知 canonical facet（槽 id 前缀；动态槽为 `${facet}-${index}`） */
export type CompositeFacetId = "identity" | "projects" | "employers";

/** 槽 id：已知 facet、plan-N，或 `${facet}-${index}` / external_link-* */
export type CompositeSlotId = CompositeFacetId | `plan-${number}` | string;

/** 一个执行槽：由 pathPlan.steps 按序派生（含 km/list/mem/tool/summarize） */
export type CompositeRetrievalSlot = {
  id: CompositeSlotId;
  label: string;
  searchQuery: string;
  queryType: NonNullable<IntakeRoutingDecision["queryType"]>;
  topics: string[];
  subTasks: string[];
  /** 空证据策略（来自 pathPlan.steps） */
  emptyPolicy?: EmptyPolicy;
  /**
   * Send 工人：km_retrieve | list_corpus | mem_recall | tool_run | summarize_slot | corpus_edit
   */
  executor?: SlotExecutor;
  enumerationControl?: EnumerationControl | null;
  identityField?: IntakeIdentityField | null;
  enumerationPage?: number;
  enumerationPageSize?: number;
  /** 来自 LLM pathPlan 步；白名单工具 */
  toolId?: ToolRunId | null;
  dataSource?: DataSource | null;
  /** translate_text：目标语 */
  targetLang?: string | null;
  /** translate_text：源语 */
  sourceLang?: string | null;
  /** mem 步：用户自述字段 slug */
  userFactKey?: string | null;
  userFactLabel?: string | null;
  /** corpus_edit 等：透传 pathPlan.steps[].params */
  params?: Record<string, unknown> | null;
};

/** 槽从何而来（端到端：LLM pathPlan） */
export type CompositeRoutePlanSource =
  | "intake_path_plan"
  | "intake_retrieval_plan"
  | "none";

export type ResolvedCompositeRoute = {
  slots: CompositeRetrievalSlot[];
  source: CompositeRoutePlanSource;
};

export type EnumerationTarget = "project" | "experience";

export type EnumerationTargetInput = Pick<
  IntakeRetrievalPlanItem,
  "label" | "searchQuery" | "topics"
> & {
  subTasks?: string[];
  /** 优先于 topics：来自 enumerationControl.listKind */
  listKind?: "project" | "experience" | null;
};
