/**
 * Intake 之后：每槽 Send（km/list）∥ planDag ∥ userFactSide。
 * 单槽工人内 FC；全部槽 → planSlotJoin → planSlotPost(tools) → planMerge（与 dag 汇合）。
 */
import { Send } from "@langchain/langgraph";
import { emptyPathPlan } from "@/agentflow/agents/online/intake-coordinator/path-plan";
import { routeUserFactSideEffect } from "@/agentflow/agents/online/user-fact";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

export const pathHasHybridDag = (state: PipelineGraphState): boolean => {
  const pathPlan = state.decision?.pathPlan ?? emptyPathPlan();
  return (
    pathPlan.steps.some(
      (d) => d.kind === "dag" && d.template === "hybrid_multi_source"
    ) || (state.decision?.executionPlan?.length ?? 0) > 0
  );
};

export const fanOutPlanWorkers = (state: PipelineGraphState): Send[] => {
  const decision = state.decision;
  const sends: Send[] = [];
  if (!decision) {
    return [new Send("planMerge", state)];
  }

  const slots = decision.compositeSlots ?? [];
  for (const slot of slots) {
    const payload = { ...state, activeSlotId: String(slot.id) };
    if (slot.executor === "list_corpus") {
      sends.push(new Send("listRetrieve", payload));
    } else {
      sends.push(new Send("kmRetrieve", payload));
    }
  }

  if (pathHasHybridDag(state)) {
    sends.push(new Send("planDag", state));
  }
  if (routeUserFactSideEffect(decision)) {
    sends.push(new Send("userFactSide", state));
  }

  if (sends.length === 0) {
    sends.push(new Send("planMerge", state));
  }
  return sends;
};

/** 供 SSE / 日志：本轮 fan-out 工人概况（信 structured slots，非口语） */
export const describeFanOutPlan = (
  state: PipelineGraphState
): {
  hasKm: boolean;
  hasList: boolean;
  hasDag: boolean;
  hasSideRemember: boolean;
  kmCount: number;
  listCount: number;
} => {
  const decision = state.decision;
  if (!decision) {
    return {
      hasKm: false,
      hasList: false,
      hasDag: false,
      hasSideRemember: false,
      kmCount: 0,
      listCount: 0,
    };
  }
  const slots = decision.compositeSlots ?? [];
  const kmCount = slots.filter((s) => s.executor !== "list_corpus").length;
  const listCount = slots.filter((s) => s.executor === "list_corpus").length;
  return {
    hasKm: kmCount > 0,
    hasList: listCount > 0,
    hasDag: pathHasHybridDag(state),
    hasSideRemember: Boolean(routeUserFactSideEffect(decision)),
    kmCount,
    listCount,
  };
};
