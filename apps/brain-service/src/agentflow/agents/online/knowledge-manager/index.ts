import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { runKmSlotWorker } from "./slot";

export {
  pickExcerpt,
  isProjectEntryPath,
  isExperienceEntryPath,
} from "./recall/retrieve-helpers";
export { EXCERPT_MAX } from "./profile/km-config";
export { retrieveKnowledge } from "./recall/retrieve";
export {
  MAX_CANDIDATES,
  getKmRetrievalConfig,
  getProfileRecallParams,
  PROFILE_MAX_HITS,
} from "./profile/km-config";
export { inferQueryProfile, resolveQueryProfile } from "./profile/query-profile";
export { searchCorpusVectors } from "@fambrain/corpus/corpus-vector";
export {
  knowledgeHitSchema,
  knowledgeHitsSchema,
  knowledgeRetrievalResultSchema,
  parseKnowledgeHits,
  parseKnowledgeRetrievalResult,
} from "./contract/schema";
export {
  type KnowledgeHit,
  type KnowledgeManagerInput,
  type KnowledgeRetrievalResult,
  type QueryProfile,
  type ConfidenceTier,
  type KnowledgeCandidate,
  type RecallChannel,
  type RecallSource,
  type EnumerationMeta,
} from "./contract/types";
export {
  mergeCompositeHits,
  mergeCompositeRetrieval,
  orderSubResultsBySlots,
  resolveIncrementalCompositePlan,
  cachedFacetToAnalystResult,
  analystResultToCachedFacet,
  buildFacetKey,
  detectCompositeRefreshIntent,
  attachFacetKey,
  retrieveSlotWithCache,
  type CompositeRetrievePlan,
  type CompositeSubRetrieval,
  type CompositeSlotPlan,
  type IncrementalCompositePlan,
} from "./composite";
export {
  assessConfidence,
  deriveCoverageFromTier,
  shouldCoalesceEmptyHits,
} from "./profile/score-candidate";
export { hybridRecall } from "./recall/hybrid-recall";
export { fuseRrf } from "./recall/fusion-rrf";

/**
 * LangGraph `kmRetrieve` 节点：复合路径每槽 Send 工人（executor ≠ list_corpus）。
 * retrieve + FC + 局部重检 → fanOutSlotPatches → planSlotJoin。
 */
export const runKmRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("KnowledgeManager", "进入", {
    via: "kmRetrieve",
    slotId: state.activeSlotId,
  });

  const patch = await runKmSlotWorker(state);

  logAgentOut("KnowledgeManager", "出去", {
    via: "kmRetrieve",
    slotId: patch.slotId,
    hitCount: patch.sub.hits.length,
    coverage: patch.sub.coverage,
    fcPassed: patch.stepResult.fc?.passed ?? null,
    retried: Boolean(patch.retried),
  });

  return { fanOutSlotPatches: [patch] };
};
