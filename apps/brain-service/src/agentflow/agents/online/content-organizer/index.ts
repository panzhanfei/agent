/**
 * ContentOrganizer：hits 去重合并。包根只聚合；逻辑在 organize/，schema 在 contract/。
 */
import { resolveQueryProfile } from "@/agentflow/agents/online/knowledge-manager";
import { ENUMERATION_EXHAUSTIVE_PAGE_SIZE } from "@/agentflow/agents/online/corpus-lister/list";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { organizeKnowledge } from "./organize";

export type {
  ContentOrganizerInput,
  ContentOrganizerResult,
} from "./interface";
export { organizeKnowledge, dedupeCitations, normalizeDocPath, organizeHits } from "./organize";
export {
  knowledgeHitSchema,
  knowledgeHitsSchema,
  parseKnowledgeHits,
} from "./contract";

/** LangGraph contentOrganizer 节点 */
export const runContentOrganizerNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  const queryProfile = decision
    ? resolveQueryProfile(
        decision.searchQuery || state.userQuestion,
        decision.subTasks,
        decision.queryType
      )
    : undefined;
  const paginatedList =
    decision?.listIntent === "exhaustive" ||
    decision?.listIntent === "continue";
  const pageFromMeta = state.enumerationMeta?.pageSize;
  const maxHitsOverride = paginatedList
    ? (decision.enumerationPageSize ??
      pageFromMeta ??
      ENUMERATION_EXHAUSTIVE_PAGE_SIZE)
    : queryProfile === "enumeration" && pageFromMeta
      ? pageFromMeta
      : undefined;
  const organized = organizeKnowledge({
    hits: state.hits,
    coverage: state.coverage,
    notes: state.notes,
    queryProfile,
    maxHitsOverride,
  });
  return {
    hits: organized.hits,
    coverage: organized.coverage,
    notes: organized.notes,
  };
};
