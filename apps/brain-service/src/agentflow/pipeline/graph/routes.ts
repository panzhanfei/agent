import { Send } from "@langchain/langgraph";
import { isSummarizeComposeDecision } from "@/agentflow/agents/online/content-summarizer/route";
import type { IntakeRouteMode } from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import {
  fanOutPlanWorkers,
  routeAfterPlanSlotJoin,
} from "@/agentflow/agents/online/plan-fanout";
import { shouldOfferVaultSaveGate } from "@/agentflow/agents/online/vault-write";
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

/** contentSummarizer 之后：摘要终稿可进写回闸门；否则 respondEarly / analyst */
export const routeAfterContentSummarizer = (
  state: PipelineGraphState
): "vaultSaveGate" | "respondEarly" | "analyst" => {
  if (state.error) return "respondEarly";
  if (shouldOfferVaultSaveGate(state)) return "vaultSaveGate";
  if (state.exitEarly) return "respondEarly";
  return "analyst";
};

/** Analyst 之后：附件翻译/总结终稿进写回闸门；普通 QA 直接收尾 */
export const routeAfterAnalyst = (
  state: PipelineGraphState
): "vaultSaveGate" | "persistTurnEnd" => {
  if (shouldOfferVaultSaveGate(state)) return "vaultSaveGate";
  return "persistTurnEnd";
};
