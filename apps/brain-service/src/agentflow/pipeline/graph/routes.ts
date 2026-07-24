import type { PipelineGraphState } from "./state";
import type { IntakeRouteMode } from "@/agentflow/agents/online/intake-coordinator/guards/interface";

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
 * Intake 之后：只信 decision.routeMode（与图节点名 1:1）。
 * 复杂判定在 Intake 出口 resolveIntakeGraphRouteMode，不在本文件展开。
 */
export const routeAfterIntake = (
  state: PipelineGraphState
): IntakeRouteMode => {
  if (state.exitEarly || state.error || !state.decision) {
    return "respondEarly";
  }
  return state.decision.routeMode;
};

/** planExecutor 之后统一进入 contentOrganizer → contentSummarizer */
export const routeAfterPlanExecutor = (
  state: PipelineGraphState
): "contentOrganizer" | "respondEarly" => {
  if (state.error) return "respondEarly";
  return "contentOrganizer";
};

/** contentSummarizer 之后：终态摘要 → respondEarly；qa/composite → analyst */
export const routeAfterContentSummarizer = (
  state: PipelineGraphState
): "respondEarly" | "analyst" => {
  if (state.error || state.exitEarly) return "respondEarly";
  return "analyst";
};

/** @deprecated 保留导出名供旧脚本；图已不再使用 */
export const routeAfterRetrieval = routeAfterPlanExecutor;

/** @deprecated 图已内嵌 per-step FC */
export const routeAfterFactChecker = (
  _state: PipelineGraphState
): "contentOrganizer" => "contentOrganizer";
