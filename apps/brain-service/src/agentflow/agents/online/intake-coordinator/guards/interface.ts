/**
 * Intake guards 类型约定。
 *
 * routeMode：LangGraph 图路由（与 compile.ts 节点名 1:1）。
 * 由 Intake 出口 resolveIntakeGraphRouteMode 写入；routes.ts 只读本字段分发。
 * 节点内执行看 pathPlan / compositeSlots / executionPlan，不二次解读 routeMode。
 */
import type {
  CompositeRetrievalSlot,
  CompositeRoutePlanSource,
} from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import type {
  ComposeMode,
  PathPlan,
} from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import type { UserFactRoute } from "@/agentflow/agents/online/user-fact";
import type {
  EnrichedPlanItem,
  ExecutionPlanNode,
} from "@/agentflow/agents/online/tool-orchestrator";

/**
 * Intake → 下一图节点（与 StateGraph.addNode 名一致）。
 * km/list/tool/dag 并存时一律 planFanOut（Send 并行工人）。
 */
export type IntakeRouteMode =
  | "respondEarly"
  | "userFact"
  | "listRetriever"
  | "planFanOut"
  | "contentSummarizer";

/** 为何走到当前 routeMode（写进日志 routeReason） */
export type CompositeRouteReason =
  | "skip_non_retrieve"
  | "intake_path_plan"
  | "intake_retrieval_plan";

export type EnumerationListIntent = "preview" | "continue" | "exhaustive";

export type IntakeRetrievalPlanGuardReason =
  | "noop"
  | "repaired_plan"
  | "canonicalized";

export type IntakeContinuationGuardReason = "noop";

export type IntakeLinkLookupGuardReason =
  | "noop"
  | "single_external_link"
  | "preserve_mixed_plan"
  | "harmonize_plan_query_types"
  | "harmonize_query_type";

export type AttachmentAction = "extract" | "summarize" | "translate";

export type ApplyAttachmentActionResult = {
  decision: IntakeRoutingDecision;
  /** 直接作答（extract） */
  answer?: string;
  earlyExit: boolean;
};

/**
 * Intake 编排工单（写入 state.decision）。
 * 主契约：pathPlan.steps[]（有序）+ composeMode；compositeSlots / answerOrder 由 steps 派生。
 */
export type RoutedIntakeDecision = IntakeRoutingDecision & {
  /** 图路由：与 LangGraph 节点名 1:1；routes.ts 只读本字段 */
  routeMode: IntakeRouteMode;
  /** 由 pathPlan.steps 派生的检索槽（dag 步不进槽） */
  compositeSlots: CompositeRetrievalSlot[];
  /** 有序执行计划；LLM 产出 steps[]，代码合法化 + 结构归一 */
  pathPlan: PathPlan;
  /** 回答顺序（step id）；默认 = steps.map(s => s.id) */
  answerOrder: string[];
  /** 出稿模式：qa | summarize | composite */
  composeMode: ComposeMode;
  routeReason?: CompositeRouteReason;
  routePlanSource?: CompositeRoutePlanSource;
  /** 用户自述联系方式 remember/recall，不经 KM */
  userFact?: UserFactRoute | null;
  /** preview=首屏；exhaustive=穷举；continue=续页「更多」 */
  listIntent?: EnumerationListIntent | null;
  enumerationPage?: number;
  enumerationPageSize?: number;
  enumerationListKind?: "project" | "experience";
  /** 混合 DAG：planFanOut 内 planDag 工人执行 */
  executionPlan?: ExecutionPlanNode[];
  /** retrievalPlan 平行 enrich（toolId/dataSource）；槽级以 compositeSlots 上挂载为准 */
  enrichedPlan?: EnrichedPlanItem[];
};
