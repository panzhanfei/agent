/**
 * planSlotPost：Join（及可选再批）之后、Merge 之前。
 * 把汇合后的 hits 交给 tool-run 跑 post-retrieval 工具，结果写回 fanOutSlotPatch。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { runToolOrchestratorNode } from "@/agentflow/agents/online/tool-orchestrator/tool-run";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PlanSlotsPatch } from "../interface";

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
    toolResults: {
      ...(state.toolResults ?? {}),
      ...(slotPatch.toolResults ?? {}),
    },
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
