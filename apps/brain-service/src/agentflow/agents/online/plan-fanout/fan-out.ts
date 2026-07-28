/**
 * Intake 之后：按 pathPlan 结构 Send 并行工人（km / dag / userFact side-effect）。
 * km 之后串 planSlotPost（FC + tools），再与其它工人汇合于 planMerge。
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

/**
 * 返回 LangGraph Send[]：独立工人并行；汇合于 planMerge。
 * 有 compositeSlots → 从 kmRetrieve 起步（边：kmRetrieve → planSlotPost → planMerge）。
 */
export const fanOutPlanWorkers = (state: PipelineGraphState): Send[] => {
  const decision = state.decision;
  const sends: Send[] = [];
  if (!decision) {
    return [new Send("planMerge", state)];
  }

  const hasSlots = (decision.compositeSlots?.length ?? 0) > 0;
  const hasDag = pathHasHybridDag(state);
  const hasSideRemember = Boolean(routeUserFactSideEffect(decision));

  if (hasSlots) sends.push(new Send("kmRetrieve", state));
  if (hasDag) sends.push(new Send("planDag", state));
  if (hasSideRemember) sends.push(new Send("userFactSide", state));

  if (sends.length === 0) {
    sends.push(new Send("planMerge", state));
  }
  return sends;
};
