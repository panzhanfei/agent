/**
 * compose_enumeration / list_corpus_entries：列举成稿。
 */
import { composeEnumerationAnswer } from "@/agentflow/agents/online/information-analyst/compose";
import type { InformationAnalystResult } from "@/agentflow/agents/online/information-analyst/interface";
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type {
  ToolRunId,
  ToolRunResult,
} from "@/agentflow/agents/online/tool-orchestrator/interface";

const analystToToolResult = (
  toolId: ToolRunId,
  label: string,
  result: InformationAnalystResult,
  hits: KnowledgeHit[] = []
): ToolRunResult => ({
  toolId,
  label,
  ok: !result.insufficientEvidence,
  answer: result.answer,
  citations: result.citations,
  hits,
  blocks: result.blocks,
  insufficientEvidence: result.insufficientEvidence,
  confidence: result.confidence,
});

export const runComposeEnumeration = (input: {
  hits: KnowledgeHit[];
  language: "zh" | "en" | "mixed";
  topics: string[];
  label: string;
  enumerationMeta: PipelineGraphState["enumerationMeta"];
  notes: string | null;
  listIntent: RoutedIntakeDecision["listIntent"];
}): ToolRunResult => {
  const result = composeEnumerationAnswer({
    hits: input.hits,
    language: input.language,
    topics: input.topics,
    label: input.label,
    enumerationMeta: input.enumerationMeta,
    notes: input.notes,
    listIntent: input.listIntent,
  });
  return analystToToolResult(
    "compose_enumeration",
    input.label,
    result,
    input.hits
  );
};

/** DAG / 兜底：无 hits 时扫目录再成稿 */
export const runListCorpusEntries = async (input: {
  corpusUserId: string;
  topics: string[];
  label: string;
  language: "zh" | "en" | "mixed";
}): Promise<ToolRunResult> => {
  const { retrieveEnumerationPage } = await import(
    "@/agentflow/agents/online/corpus-lister"
  );
  const listKind = (input.topics ?? []).some((t) => /^project/i.test(t))
    ? "project"
    : "experience";
  const retrieval = await retrieveEnumerationPage({
    corpusUserId: input.corpusUserId,
    listKind,
    page: 1,
    pageSize: 20,
  });
  return runComposeEnumeration({
    hits: retrieval.hits,
    language: input.language,
    topics: input.topics ?? [listKind],
    label: input.label,
    enumerationMeta: retrieval.enumerationMeta ?? null,
    notes: retrieval.notes,
    listIntent: "exhaustive",
  });
};
