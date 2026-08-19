/**
 * 将 RoutedIntakeDecision 收成 LangGraph 下一跳（routeMode）。
 * 复杂判定集中在此；routes.ts 只读 routeMode 分发（planFanOut → Send[]）。
 */
import type {
  IntakeRouteMode,
  RoutedIntakeDecision,
} from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import { isPureSummarizeDecision } from "@/agentflow/agents/online/content-summarizer/route";
import { isPureListDecision } from "@/agentflow/agents/online/corpus-lister";
import {
  isUserFactIntent,
  routeUserFactSideEffect,
} from "@/agentflow/agents/online/user-fact";
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
  if (!pathPlan?.steps) return false;
  return pathPlan.steps.length > 0;
};

/**
 * Intake 出口：算出图路由 routeMode。
 *
 * 优先级：vault_workspace → 纯 userFact → respondEarly → contentSummarizer → listRetriever → planFanOut。
 * 同轮 remember side-effect（retrieve + userFactKey/Value）→ planFanOut（不独占 userFact）。
 */
export const resolveIntakeGraphRouteMode = (
  decision: RoutedIntakeDecision
): IntakeRouteMode => {
  const hasRetrievePlan =
    hasPathPlanSteps(decision) || intakeRequiresKmRetrieval(decision);
  const hasSideRemember = Boolean(routeUserFactSideEffect(decision));

  if (decision.pathPlan?.steps?.some((s) => s.kind === "vault_workspace")) {
    return "fileHandoff";
  }
  // 纯 remember/recall；混有检索 steps / side-effect 时走 planFanOut
  if (isUserFactIntent(decision.intent) && !hasRetrievePlan) {
    return "userFact";
  }
  if (isRespondEarlyDecision(decision)) {
    return "respondEarly";
  }
  if (isPureSummarizeDecision(decision)) {
    return "contentSummarizer";
  }
  if (isPureListDecision(decision) && !hasSideRemember) {
    return "listRetriever";
  }
  if (hasRetrievePlan || hasSideRemember) {
    return "planFanOut";
  }
  return "planFanOut";
};
