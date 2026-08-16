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
  recallDocKindsForQuery,
  resolveQueryProfile,
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
  runKmSlotWorker,
  type ExecuteKmSlotSubInput,
} from "./slot";

export { searchCorpusVectors } from "@fambrain/corpus/corpus-vector";

import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { emitBudgetedSlotPatch } from "@/agentflow/agents/online/plan-fanout/slot-budget";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { runKmSlotWorker } from "./slot";

/** LangGraph `kmRetrieve`：单槽工人 + 一层预算，与 list/mem 同形 */
export const runKmRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("KnowledgeManager", "进入", {
    via: "kmRetrieve",
    slotId: state.activeSlotId,
  });

  const out = await emitBudgetedSlotPatch(state, "km", () =>
    runKmSlotWorker(state)
  );
  const patch = out.fanOutSlotPatches?.[0];

  logAgentOut("KnowledgeManager", "出去", {
    via: "kmRetrieve",
    slotId: patch?.slotId ?? state.activeSlotId,
    hitCount: patch?.sub.hits.length ?? 0,
    coverage: patch?.sub.coverage ?? null,
    retried: Boolean(patch?.retried),
    slotStatus: patch?.slotRuntime?.status ?? null,
    slotReason: patch?.slotRuntime?.reason ?? null,
  });

  return out;
};
