/**
 * 将 RoutedIntakeDecision 收成 LangGraph 下一跳（routeMode）。
 * 复杂判定集中在此；routes.ts 只读 routeMode 分发。
 */
import type {
  IntakeRouteMode,
  RoutedIntakeDecision,
} from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import { isPureSummarizeDecision } from "@/agentflow/agents/online/content-summarizer/summarize-route";
import { isPureListDecision } from "@/agentflow/agents/online/corpus-lister/pure-list-route";
import { isUserFactIntent } from "@/agentflow/agents/online/user-fact";
import { intakeRequiresKmRetrieval } from "./intake-km-routing";

const isRespondEarlyDecision = (decision: IntakeRoutingDecision): boolean => {
  if (decision.intent === "clarify" && Boolean(decision.clarifyingQuestion?.trim())) {
    return true;
  }
  if (
    (decision.intent === "chitchat" || decision.intent === "out_of_scope") &&
    Boolean(decision.briefReply?.trim())
  ) {
    return true;
  }
  if (
    decision.intent === "direct_answer" &&
    Boolean(decision.briefReply?.trim())
  ) {
    return true;
  }
  return Boolean(decision.briefReply?.trim());
};

const hasPathPlanSteps = (decision: RoutedIntakeDecision): boolean => {
  const pathPlan = decision.pathPlan;
  if (!pathPlan) return false;
  return (
    pathPlan.km.length +
      pathPlan.list.length +
      pathPlan.tool.length +
      pathPlan.dag.length >
    0
  );
};

/**
 * Intake 出口：算出图路由 routeMode（与 compile.ts 节点名一致）。
 *
 * 优先级：respondEarly → userFact → contentSummarizer → listRetriever → planExecutor。
 * km/list/tool/dag 并存一律 planExecutor（节点内混排）。
 */
export const resolveIntakeGraphRouteMode = (
  decision: RoutedIntakeDecision
): IntakeRouteMode => {
  if (isRespondEarlyDecision(decision)) {
    return "respondEarly";
  }
  if (isUserFactIntent(decision.intent)) {
    return "userFact";
  }
  if (isPureSummarizeDecision(decision)) {
    return "contentSummarizer";
  }
  if (isPureListDecision(decision)) {
    return "listRetriever";
  }
  if (hasPathPlanSteps(decision) || intakeRequiresKmRetrieval(decision)) {
    return "planExecutor";
  }
  // 兜底：进 planExecutor（空 plan 会报错，优于静默丢弃）
  return "planExecutor";
};
