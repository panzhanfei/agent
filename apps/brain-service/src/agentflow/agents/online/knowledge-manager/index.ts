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
export {
  inferQueryProfile,
  resolveQueryProfile,
} from "./profile/query-profile";
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
  type CompositeRetrievePlan,
  type CompositeSubRetrieval,
} from "./composite";
export {
  assessConfidence,
  deriveCoverageFromTier,
  shouldCoalesceEmptyHits,
} from "./profile/score-candidate";
export { hybridRecall } from "./recall/hybrid-recall";
export { fuseRrf } from "./recall/fusion-rrf";
export {
  executeKmSlotSub,
  getCompiledKmSlotGraph,
  runKmRetrieveNode,
  runKmSlotWorker,
  type ExecuteKmSlotSubInput,
} from "./slot";

/** @deprecated 请用 @/agentflow/cache */
export {
  resolveCompositeCachePlan,
  resolveIncrementalCompositePlan,
  cachedFacetToAnalystResult,
  analystResultToCachedFacet,
  buildFacetKey,
  detectCompositeRefreshIntent,
  attachFacetKey,
  writeHitsCache,
  type CompositeCachePlan,
  type CompositeSlotPlan,
  type IncrementalCompositePlan,
} from "@/agentflow/cache";
