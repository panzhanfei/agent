import { dedupeCitations } from "@/agentflow/agents/online/content-organizer";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import { buildTenureAnswer, extractTenureFromHits } from "./compute-tenure";

export const runComputeTenureFromHits = (input: {
  hits: KnowledgeHit[];
  language: "zh" | "en" | "mixed";
  label: string;
  asOfDate: string;
  searchQuery?: string;
}): ToolRunResult => {
  const extraction = extractTenureFromHits(input.hits);
  const { answer, insufficientEvidence } = buildTenureAnswer({
    extraction,
    language: input.language,
    asOfDate: input.asOfDate,
    searchQuery: input.searchQuery,
  });
  const citations =
    extraction?.sourceHit && !insufficientEvidence
      ? dedupeCitations([
          {
            path: extraction.sourceHit.path,
            excerpt: extraction.sourceHit.excerpt,
          },
        ])
      : [];
  return {
    toolId: "compute_tenure_from_hits",
    label: input.label,
    ok: !insufficientEvidence,
    answer,
    citations,
    hits: input.hits,
    insufficientEvidence,
    confidence: insufficientEvidence ? 0.85 : 0.92,
  };
};
