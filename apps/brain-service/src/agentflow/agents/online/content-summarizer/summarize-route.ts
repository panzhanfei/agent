import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import { intakeRequiresKmRetrieval } from "@/agentflow/agents/online/intake-coordinator/pipeline";

/** 本轮是否需要 ContentSummarizer 产出（终态摘要或复合链内摘要）。 */
export const isSummarizeComposeDecision = (
    decision: Pick<RoutedIntakeDecision, "composeMode" | "intent">
): boolean =>
    decision.composeMode === "summarize" ||
    decision.intent === "summarize_content";

/**
 * 纯总结短路：用户粘贴长文 / 无 searchQuery，不经 planFanOut。
 */
export const isPureSummarizeDecision = (
    decision: RoutedIntakeDecision
): boolean => {
    if (!isSummarizeComposeDecision(decision)) return false;
    const hasPathSteps = (decision.pathPlan?.steps?.length ?? 0) > 0;
    return !hasPathSteps && !intakeRequiresKmRetrieval(decision);
};
