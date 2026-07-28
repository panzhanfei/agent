/**
 * Intake 之后：Send 并行 km / list / dag / userFact side-effect。
 * km∥list∥userFactSide → planSlotPost（FC+tools）→ 与 dag 汇合于 planMerge。
 * （userFactSide 必须并入 planSlotPost，避免先到 planMerge 抢跑）
 */
import { Send } from "@langchain/langgraph";
import { emptyPathPlan } from "@/agentflow/agents/online/intake-coordinator/path-plan";
import { splitCompositeSlotsByExecutor } from "@/agentflow/agents/online/knowledge-manager";
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

  const plan = describeFanOutPlan(state);
  if (plan.hasKm) sends.push(new Send("kmRetrieve", state));
  if (plan.hasList) sends.push(new Send("listRetrieve", state));
  if (plan.hasDag) sends.push(new Send("planDag", state));
  if (plan.hasSideRemember) sends.push(new Send("userFactSide", state));

  if (sends.length === 0) {
    sends.push(new Send("planMerge", state));
  }
  return sends;
};

/** 供 SSE / 日志：本轮 fan-out 会启动哪些工人（信 structured slots，非口语） */
export const describeFanOutPlan = (
  state: PipelineGraphState
): {
  hasKm: boolean;
  hasList: boolean;
  hasDag: boolean;
  hasSideRemember: boolean;
} => {
  const decision = state.decision;
  if (!decision) {
    return {
      hasKm: false,
      hasList: false,
      hasDag: false,
      hasSideRemember: false,
    };
  }
  const { kmSlots, listSlots } = splitCompositeSlotsByExecutor(
    decision.compositeSlots ?? []
  );
  return {
    hasKm: kmSlots.length > 0,
    hasList: listSlots.length > 0,
    hasDag: pathHasHybridDag(state),
    hasSideRemember: Boolean(routeUserFactSideEffect(decision)),
  };
};
