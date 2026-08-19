import { dedupeCitations } from "@/agentflow/agents/online/content-organizer";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import { runWithToolContext } from "../../context";
import { computeAgeFromHitsTool } from "./compute-age-from-hits";

export const runComputeAgeFromHits = async (input: {
  corpusUserId: string;
  actorUserId: string;
  hits: KnowledgeHit[];
  asOfDate: string;
  language: "zh" | "en" | "mixed";
  label: string;
}): Promise<ToolRunResult> => {
  const raw = await runWithToolContext(
    { corpusUserId: input.corpusUserId, actorUserId: input.actorUserId },
    () =>
      computeAgeFromHitsTool.invoke({
        hits: input.hits.map((h) => ({
          path: h.path,
          excerpt: h.excerpt,
        })),
        asOfDate: input.asOfDate,
        language: input.language,
      })
  );
  const parsed = JSON.parse(String(raw)) as {
    answer: string;
    insufficientEvidence: boolean;
    sourcePath: string | null;
  };
  const citations =
    parsed.sourcePath && input.hits[0]
      ? dedupeCitations([
          {
            path: parsed.sourcePath,
            excerpt: input.hits[0]!.excerpt,
          },
        ])
      : [];
  return {
    toolId: "compute_age_from_hits",
    label: input.label,
    ok: !parsed.insufficientEvidence,
    answer: parsed.answer,
    citations,
    hits: input.hits,
    insufficientEvidence: parsed.insufficientEvidence,
    confidence: parsed.insufficientEvidence ? 0.85 : 0.9,
  };
};
