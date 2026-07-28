/**
 * planMerge：汇合 fan-out 工人补丁 → hits / stepResults / toolResults。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { emptyPathPlan } from "@/agentflow/agents/online/intake-coordinator/path-plan";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import type { PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/types";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import {
  buildDagStepResults,
  mergeCompositeWithDagSteps,
  mergeStepResultsByAnswerOrder,
} from "../merge-composite-dag";
import { pathHasHybridDag } from "../fan-out";

export const runPlanMergeNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  if (!decision) {
    return { error: "缺少入口路由决策" };
  }

  const pathPlan = decision.pathPlan ?? emptyPathPlan();
  const answerOrder = decision.answerOrder ?? [];
  const slotPatch = state.fanOutSlotPatch;
  const dagPatch = state.fanOutDagPatch;
  const hasSlots = Boolean(slotPatch);
  const hasDag = Boolean(dagPatch) || pathHasHybridDag(state);

  if (!hasSlots && !hasDag && !state.sideEffectAnswer) {
    return { error: "pathPlan 为空且无 compositeSlots" };
  }

  if (slotPatch?.error) {
    return { error: slotPatch.error };
  }
  if (dagPatch?.error) {
    return { error: dagPatch.error };
  }

  let working: PipelineGraphState = { ...state };
  let slotStepResults: StepResult[] = slotPatch?.slotStepResults ?? [];
  let mergedToolResults: PipelineToolResults = {
    ...(state.toolResults ?? {}),
  };

  if (slotPatch) {
    working = {
      ...working,
      hits: slotPatch.hits ?? [],
      coverage: slotPatch.coverage ?? "none",
      notes: slotPatch.notes ?? null,
      confidenceTier: slotPatch.confidenceTier ?? null,
      enumerationMeta: slotPatch.enumerationMeta ?? null,
      retrievalCacheHit: Boolean(slotPatch.retrievalCacheHit),
      retrievalCacheSlotHits: slotPatch.retrievalCacheSlotHits ?? null,
      compositeSubResults: slotPatch.compositeSubResults ?? null,
      compositeIncrementalPlan: slotPatch.compositeIncrementalPlan ?? null,
      compositeFacetCacheHits: slotPatch.compositeFacetCacheHits ?? null,
      checkerPassed: slotPatch.checkerPassed ?? true,
      retryCount: slotPatch.retryCount ?? working.retryCount,
    };
    mergedToolResults = {
      ...mergedToolResults,
      ...(slotPatch.toolResults ?? {}),
    };
  }

  let dagStepResults: StepResult[] = [];
  if (dagPatch) {
    const dagStatePatch: Partial<PipelineGraphState> = {
      hits: dagPatch.hits,
      coverage: dagPatch.coverage,
      notes: dagPatch.notes,
      toolResults: dagPatch.toolResults,
    };
    dagStepResults = buildDagStepResults(pathPlan, dagStatePatch);
    mergedToolResults = {
      ...mergedToolResults,
      ...(dagPatch.toolResults ?? {}),
    };

    const dagRuns = pathPlan.steps.filter(
      (d) => d.kind === "dag" && d.template === "hybrid_multi_source"
    );
    const compositeMerge =
      hasSlots && dagRuns.length > 0
        ? mergeCompositeWithDagSteps(
            working,
            pathPlan,
            answerOrder,
            dagRuns,
            dagStatePatch
          )
        : null;

    working = {
      ...working,
      ...dagStatePatch,
      ...(compositeMerge ?? {}),
      toolResults: mergedToolResults,
    };
  }

  const stepResults = mergeStepResultsByAnswerOrder(
    answerOrder,
    pathPlan,
    slotStepResults,
    dagStepResults
  );

  const notesWithSide = [state.sideEffectAnswer, working.notes]
    .filter(Boolean)
    .join("\n\n") || working.notes;

  logAgentOut("PlanMerge", "完成", {
    stepCount: stepResults.length,
    slotSteps: slotStepResults.length,
    dagSteps: dagStepResults.length,
    hasSideEffect: Boolean(state.sideEffectAnswer),
    toolKeys: Object.keys(mergedToolResults),
    coverage: working.coverage,
  });

  return {
    ...working,
    notes: notesWithSide,
    toolResults: mergedToolResults,
    stepResults,
    checkerPassed: true,
    // 清工人通道
    fanOutKmPatch: null,
    fanOutListPatch: null,
    fanOutSlotPatch: null,
    fanOutDagPatch: null,
  };
};
