/**
 * kmRetrieve：复合槽路径的 KnowledgeManager 图节点（仅检索，不含 FC/tools）。
 * 结果写入 fanOutSlotPatch，再经 planSlotPost → planMerge。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { runRetrievalNode } from "@/agentflow/agents/online/knowledge-manager";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PlanSlotsPatch } from "../interface";

export const runKmRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  if (!decision) {
    return {
      fanOutSlotPatch: { error: "缺少入口路由决策", hits: [], coverage: "none" },
    };
  }

  const hasSlots = (decision.compositeSlots?.length ?? 0) > 0;
  if (!hasSlots) {
    return { fanOutSlotPatch: null };
  }

  logAgentOut("KnowledgeManager", "进入", {
    slotCount: decision.compositeSlots.length,
    composeMode: decision.composeMode,
    via: "kmRetrieve",
  });

  const retrievalPatch = await runRetrievalNode(state);
  if (retrievalPatch.error) {
    return {
      fanOutSlotPatch: {
        error: retrievalPatch.error,
        hits: [],
        coverage: "none",
      },
    };
  }

  const patch: PlanSlotsPatch = {
    hits: retrievalPatch.hits ?? [],
    coverage: retrievalPatch.coverage ?? "none",
    notes: retrievalPatch.notes ?? null,
    confidenceTier: retrievalPatch.confidenceTier ?? null,
    enumerationMeta: retrievalPatch.enumerationMeta ?? null,
    retrievalCacheHit: Boolean(retrievalPatch.retrievalCacheHit),
    retrievalCacheSlotHits: retrievalPatch.retrievalCacheSlotHits ?? null,
    compositeSubResults: retrievalPatch.compositeSubResults ?? null,
    compositeIncrementalPlan: retrievalPatch.compositeIncrementalPlan ?? null,
    compositeFacetCacheHits: retrievalPatch.compositeFacetCacheHits ?? null,
    checkerPassed: true,
    retryCount: state.retryCount,
    error: null,
  };

  logAgentOut("KnowledgeManager", "出去", {
    hitCount: patch.hits?.length ?? 0,
    coverage: patch.coverage,
    cacheHit: patch.retrievalCacheHit,
  });

  return { fanOutSlotPatch: patch };
};
