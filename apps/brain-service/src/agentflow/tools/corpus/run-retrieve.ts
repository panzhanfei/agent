import { dedupeCitations } from "@/agentflow/agents/online/content-organizer";
import { retrieveKnowledge } from "@/agentflow/agents/online/knowledge-manager";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";

export const runRetrieveCorpus = async (input: {
  corpusUserId: string;
  actorUserId: string;
  searchQuery: string;
  queryType?: string;
  topics?: string[];
  subTasks?: string[];
  label: string;
}): Promise<ToolRunResult> => {
  const result = await retrieveKnowledge({
    corpusUserId: input.corpusUserId,
    searchQuery: input.searchQuery,
    topics: input.topics ?? [],
    subTasks: input.subTasks ?? [],
    queryType: (input.queryType as never) ?? null,
    candidates: [],
  });
  const hits: KnowledgeHit[] = result.hits;
  const answer =
    hits.length > 0
      ? hits
          .slice(0, 3)
          .map((h) => `${h.title}：${h.excerpt.slice(0, 120)}`)
          .join("\n")
      : "语料未检索到相关内容。";
  return {
    toolId: "retrieve_corpus",
    label: input.label,
    ok: hits.length > 0,
    answer,
    citations: dedupeCitations(
      hits.slice(0, 3).map((h) => ({
        path: h.path,
        excerpt: h.excerpt,
      }))
    ),
    hits,
    insufficientEvidence: hits.length === 0,
    confidence: hits.length > 0 ? 0.75 : 0.85,
  };
};
