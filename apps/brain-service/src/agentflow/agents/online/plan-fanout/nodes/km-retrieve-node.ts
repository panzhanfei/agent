/**
 * kmRetrieve：仅跑 executor≠list_corpus 的槽；写入 fanOutKmPatch。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import {
  mergeCompositeRetrieval,
  retrieveKmCompositeSlots,
} from "@/agentflow/agents/online/knowledge-manager";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PlanSlotsPatch } from "../interface";

export const runKmRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  if (!decision) {
    return {
      fanOutKmPatch: { error: "缺少入口路由决策", hits: [], coverage: "none" },
    };
  }

  logAgentOut("KnowledgeManager", "进入", {
    via: "kmRetrieve",
    slotCount: decision.compositeSlots?.length ?? 0,
  });

  const km = await retrieveKmCompositeSlots(state);
  if (km.error) {
    return {
      fanOutKmPatch: { error: km.error, hits: [], coverage: "none" },
    };
  }
  if (km.subResults.length === 0) {
    return { fanOutKmPatch: null };
  }

  const merged = mergeCompositeRetrieval(km.subResults);
  const patch: PlanSlotsPatch = {
    hits: merged.hits,
    coverage: merged.coverage,
    notes: merged.notes,
    confidenceTier: merged.confidenceTier,
    compositeSubResults: km.subResults,
    compositeIncrementalPlan: km.incremental,
    compositeFacetCacheHits: km.incremental?.facetCacheHits ?? 0,
    retrievalCacheSlotHits: km.cacheHits,
    retrievalCacheHit:
      Boolean(km.incremental) &&
      km.incremental!.activeRetrievalSlots.length > 0 &&
      km.cacheHits === km.incremental!.activeRetrievalSlots.length,
    checkerPassed: true,
    retryCount: state.retryCount,
    error: null,
  };

  logAgentOut("KnowledgeManager", "出去", {
    via: "kmRetrieve",
    hitCount: patch.hits?.length ?? 0,
    coverage: patch.coverage,
  });

  return { fanOutKmPatch: patch };
};
