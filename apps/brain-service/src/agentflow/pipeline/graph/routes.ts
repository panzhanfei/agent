import { Send } from "@langchain/langgraph";
import { isSummarizeComposeDecision } from "@/agentflow/agents/online/content-summarizer/route";
import type { IntakeRouteMode } from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import {
  fanOutPlanWorkers,
  routeAfterPlanSlotJoin,
} from "@/agentflow/agents/online/plan-fanout";
import { shouldHandoffFromPipelineState } from "@/agentflow/agents/sideline/file/handoff";
import type { PipelineGraphState } from "./state";

export { routeAfterPlanSlotJoin };

export const routeAfterRepeat = (
  state: PipelineGraphState
): "repeatRespondEarly" | "preparePipelineMemory" => {
  if (state.repeatQuestionHit) return "repeatRespondEarly";
  return "preparePipelineMemory";
};

export const routeAfterPrepareMemory = (
  state: PipelineGraphState
): "respondEarly" | "intake" => {
  if (state.exitEarly || state.error) return "respondEarly";
  return "intake";
};

/**
 * Intake 之后：只信 decision.routeMode（与图节点名 1:1，planFanOut 除外）。
 * planFanOut → planCacheResolve（全量 facet+hits 缓存）→ Send 并行工人。
 */
export const routeAfterIntake = (
  state: PipelineGraphState
): IntakeRouteMode | "planCacheResolve" | "planMerge" => {
  if (state.exitEarly || state.error || !state.decision) {
    return "respondEarly";
  }
  const mode = state.decision.routeMode;
  if (mode === "planFanOut") {
    return "planCacheResolve";
  }
  return mode;
};

/** planCacheResolve 之后：Send 每槽工人 */
export const routeAfterPlanCacheResolve = (
  state: PipelineGraphState
): Send[] | "respondEarly" | "planMerge" => {
  if (state.exitEarly || state.error || !state.decision) {
    return "respondEarly";
  }
  return fanOutPlanWorkers(state);
};

/** planMerge 之后进入 contentOrganizer */
export const routeAfterPlanMerge = (
  state: PipelineGraphState
): "contentOrganizer" | "respondEarly" => {
  if (state.error) return "respondEarly";
  return "contentOrganizer";
};

/** contentOrganizer 之后：仅 summarize 意图进 contentSummarizer；qa / list / composite → analyst */
export const routeAfterContentOrganizer = (
  state: PipelineGraphState
): "contentSummarizer" | "analyst" => {
  if (state.error) return "analyst";
  const decision = state.decision;
  if (decision && isSummarizeComposeDecision(decision)) {
    return "contentSummarizer";
  }
  return "analyst";
};

const shouldHandoffFile = (state: PipelineGraphState): boolean =>
  shouldHandoffFromPipelineState(state);

/** contentSummarizer 之后：新材料终稿交文件子线；查库摘要 respondEarly / analyst */
export const routeAfterContentSummarizer = (
  state: PipelineGraphState
): "fileHandoff" | "respondEarly" | "analyst" => {
  if (state.error) return "respondEarly";
  if (shouldHandoffFile(state)) return "fileHandoff";
  if (state.exitEarly) return "respondEarly";
  return "analyst";
};

/** Analyst 之后：有文件任务则交棒；否则直接收尾 */
export const routeAfterAnalyst = (
  state: PipelineGraphState
): "fileHandoff" | "persistTurnEnd" => {
  if (shouldHandoffFile(state)) return "fileHandoff";
  return "persistTurnEnd";
};
