import { Send } from "@langchain/langgraph";
import { isSummarizeComposeDecision } from "@/agentflow/agents/online/content-summarizer/summarize-route";
import type { IntakeRouteMode } from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import { fanOutPlanWorkers } from "@/agentflow/agents/online/plan-fanout";
import type { PipelineGraphState } from "./state";

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
 * planFanOut → LangGraph Send 并行工人；其余字符串直接跳节点。
 */
export const routeAfterIntake = (
  state: PipelineGraphState
): IntakeRouteMode | Send[] | "planMerge" => {
  if (state.exitEarly || state.error || !state.decision) {
    return "respondEarly";
  }
  const mode = state.decision.routeMode;
  if (mode === "planFanOut") {
    return fanOutPlanWorkers(state);
  }
  return mode;
};

/** planMerge 之后进入 contentOrganizer */
export const routeAfterPlanMerge = (
  state: PipelineGraphState
): "contentOrganizer" | "respondEarly" => {
  if (state.error) return "respondEarly";
  return "contentOrganizer";
};

/** @deprecated 旧名；等同 routeAfterPlanMerge */
export const routeAfterPlanExecutor = routeAfterPlanMerge;

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

/** contentSummarizer 之后：终态摘要 → respondEarly；qa/composite → analyst */
export const routeAfterContentSummarizer = (
  state: PipelineGraphState
): "respondEarly" | "analyst" => {
  if (state.error || state.exitEarly) return "respondEarly";
  return "analyst";
};

/** @deprecated 保留导出名供旧脚本；图已不再使用 */
export const routeAfterRetrieval = routeAfterPlanMerge;

/** @deprecated 图已内嵌 per-step FC */
export const routeAfterFactChecker = (
  _state: PipelineGraphState
): "contentOrganizer" => "contentOrganizer";
