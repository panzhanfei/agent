export type {
  HybridRecallResult,
  RankedCandidate,
  RrfRankedItem,
  VectorChunkRow,
} from "./interface";

export { fuseRrf } from "./fusion-rrf";
export { hybridRecall } from "./hybrid-recall";
export { retrieveKnowledge } from "./retrieve";
export {
  computeKeywordRelevance,
  computeRelevance,
  dedupeVectorByPath,
  getPathBoost,
  IDENTITY_TABLE_LABELS,
  isExperienceEntryPath,
  isProjectEntryPath,
  mergeCandidatesByPath,
  mergeChunkBodies,
  pickExcerpt,
  pickTableExcerpt,
  rankCandidates,
  sparseScoreToRelevance,
  vectorScoreToRelevance,
} from "./retrieve-helpers";
