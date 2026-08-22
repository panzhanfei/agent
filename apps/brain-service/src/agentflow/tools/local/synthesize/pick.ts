/**
 * 从 DAG toolResults 取出 synthesize_merge（不绑死节点 id）。
 */
import type {
  PipelineToolResults,
  ToolRunResult,
} from "@/agentflow/agents/online/tool-orchestrator/interface";

export const isUsableSynthesizeMerge = (
  run: ToolRunResult | undefined
): run is ToolRunResult =>
  Boolean(
    run?.toolId === "synthesize_merge" &&
      (run.answer.trim() || run.matchReport)
  );

export const pickSynthesizeMergeRun = (
  toolResults?: PipelineToolResults | null
): ToolRunResult | undefined => {
  if (!toolResults) return undefined;
  if (isUsableSynthesizeMerge(toolResults.synthesis)) {
    return toolResults.synthesis;
  }
  return Object.values(toolResults).find(isUsableSynthesizeMerge);
};

export const collectRetrieveCorpusHits = (
  toolResults?: PipelineToolResults | null
): NonNullable<ToolRunResult["hits"]> => {
  if (!toolResults) return [];
  return Object.values(toolResults).flatMap((r) =>
    r?.toolId === "retrieve_corpus" ? (r.hits ?? []) : []
  );
};
