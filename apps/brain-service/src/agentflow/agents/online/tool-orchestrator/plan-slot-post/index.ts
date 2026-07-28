/**
 * planSlotPost：槽位线 post-retrieval tools（FC 已在每槽工人内完成）。
 * 在 planFanOut join 之后调用 tool-run，结果写回 fanOutSlotPatch。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { PlanSlotsPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { runToolOrchestratorNode } from "../tool-run";

export const runPlanSlotPostNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  const slotPatch = state.fanOutSlotPatch;

  if (!decision) {
    return {
      fanOutSlotPatch: {
        error: "缺少入口路由决策",
        hits: [],
        coverage: "none",
      },
    };
  }

  if (slotPatch?.error) {
    return { fanOutSlotPatch: slotPatch };
  }

  if (!slotPatch) {
    return { fanOutSlotPatch: null };
  }

  logAgentOut("PlanSlotPost", "进入", {
    hitCount: slotPatch.hits?.length ?? 0,
    subCount: slotPatch.compositeSubResults?.length ?? 0,
  });

  let working: PipelineGraphState = {
    ...state,
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
    stepResults: slotPatch.slotStepResults ?? null,
  };

  const toolPatch = await runToolOrchestratorNode(working);
  working = { ...working, ...toolPatch };

  const patch: PlanSlotsPatch = {
    ...slotPatch,
    toolResults: working.toolResults,
    notes: working.notes,
    error: working.error,
  };

  logAgentOut("PlanSlotPost", "完成", {
    hitCount: patch.hits?.length ?? 0,
    toolKeys: Object.keys(patch.toolResults ?? {}),
  });

  return { fanOutSlotPatch: patch };
};
