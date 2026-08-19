import { dedupeCitations } from "@/agentflow/agents/online/content-organizer";
import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import {
  buildIdentityFieldAnswer,
  extractIdentityFieldFromHits,
} from "./extract-identity-field";

export const runExtractIdentityFromHits = (input: {
  hits: KnowledgeHit[];
  field: IntakeIdentityField;
  language: "zh" | "en" | "mixed";
  label: string;
}): ToolRunResult => {
  const extraction = extractIdentityFieldFromHits(input.hits, input.field);
  const { answer, insufficientEvidence } = buildIdentityFieldAnswer({
    field: input.field,
    extraction,
    language: input.language,
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
    toolId: "extract_identity_from_hits",
    label: input.label,
    ok: !insufficientEvidence,
    answer,
    citations,
    hits: input.hits,
    insufficientEvidence,
    confidence: insufficientEvidence ? 0.85 : 0.92,
  };
};
