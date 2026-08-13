/**
 * KnowledgeManager：hybrid 召回 + 单槽 Send 工人。
 * 图节点 `runKmRetrieveNode` 见文件底部。
 */

export type {
  ConfidenceTier,
  EnumerationMeta,
  KnowledgeCandidate,
  KnowledgeHit,
  KnowledgeManagerInput,
  KnowledgeRetrievalResult,
  QueryProfile,
  RecallChannel,
  RecallSource,
} from "./contract";
export {
  knowledgeHitSchema,
  knowledgeHitsSchema,
  knowledgeRetrievalResultSchema,
  parseKnowledgeHits,
  parseKnowledgeRetrievalResult,
} from "./contract";

export type {
  ConfidenceAssessment,
  ConfidenceInput,
} from "./profile";
export {
  assessConfidence,
  deriveCoverageFromTier,
  EXCERPT_MAX,
  getKmRetrievalConfig,
  getProfileRecallParams,
  inferQueryProfile,
  MAX_CANDIDATES,
  PROFILE_MAX_HITS,
  resolveQueryProfile,
  shouldCoalesceEmptyHits,
} from "./profile";

export type {
  HybridRecallResult,
  RankedCandidate,
  RrfRankedItem,
  VectorChunkRow,
} from "./recall";
export {
  fuseRrf,
  hybridRecall,
  isExperienceEntryPath,
  isProjectEntryPath,
  pickExcerpt,
  retrieveKnowledge,
} from "./recall";

export {
  mergeCompositeHits,
  mergeCompositeRetrieval,
  orderSubResultsBySlots,
  type CompositeRetrievePlan,
  type CompositeSubRetrieval,
} from "./composite";

export {
  executeKmSlotSub,
  getCompiledKmSlotGraph,
  runKmSlotWorker,
  type ExecuteKmSlotSubInput,
} from "./slot";

export { searchCorpusVectors } from "@fambrain/corpus/corpus-vector";

import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { getCompiledKmSlotGraph } from "./slot";

/** LangGraph `kmRetrieve`：兼容直接 invoke；父图优先挂编译子图 */
export const runKmRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  return getCompiledKmSlotGraph().invoke(state);
};
