/**
 * Intake 之后：每槽 Send（km/list/mem/tool/summarize）∥ planDag ∥ userFactSide。
 * km 工人内 FC；list/mem/tool/summarize 无 FC。
 * 全部槽 → planSlotJoin → planSlotPost(post-retrieval tools) → planMerge（与 dag 汇合）。
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

const sendTargetForExecutor = (
  executor: string | undefined
):
  | "kmRetrieve"
  | "listRetrieve"
  | "memRetrieve"
  | "toolRetrieve"
  | "summarizeSlot" => {
  switch (executor) {
    case "list_corpus":
      return "listRetrieve";
    case "mem_recall":
      return "memRetrieve";
    case "tool_run":
      return "toolRetrieve";
    case "summarize_slot":
      return "summarizeSlot";
    default:
      return "kmRetrieve";
  }
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
    const target = sendTargetForExecutor(slot.executor);
    sends.push(new Send(target, payload));
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

/** 供 SSE / 日志：本轮 fan-out 工人概况（信 structured slots） */
export const describeFanOutPlan = (
  state: PipelineGraphState
): {
  hasKm: boolean;
  hasList: boolean;
  hasMem: boolean;
  hasTool: boolean;
  hasSummarize: boolean;
  hasDag: boolean;
  hasSideRemember: boolean;
  kmCount: number;
  listCount: number;
  memCount: number;
  toolCount: number;
  summarizeCount: number;
} => {
  const decision = state.decision;
  if (!decision) {
    return {
      hasKm: false,
      hasList: false,
      hasMem: false,
      hasTool: false,
      hasSummarize: false,
      hasDag: false,
      hasSideRemember: false,
      kmCount: 0,
      listCount: 0,
      memCount: 0,
      toolCount: 0,
      summarizeCount: 0,
    };
  }
  const slots = decision.compositeSlots ?? [];
  const kmCount = slots.filter(
    (s) => !s.executor || s.executor === "km_retrieve"
  ).length;
  const listCount = slots.filter((s) => s.executor === "list_corpus").length;
  const memCount = slots.filter((s) => s.executor === "mem_recall").length;
  const toolCount = slots.filter((s) => s.executor === "tool_run").length;
  const summarizeCount = slots.filter(
    (s) => s.executor === "summarize_slot"
  ).length;
  return {
    hasKm: kmCount > 0,
    hasList: listCount > 0,
    hasMem: memCount > 0,
    hasTool: toolCount > 0,
    hasSummarize: summarizeCount > 0,
    hasDag: pathHasHybridDag(state),
    hasSideRemember: Boolean(routeUserFactSideEffect(decision)),
    kmCount,
    listCount,
    memCount,
    toolCount,
    summarizeCount,
  };
};
