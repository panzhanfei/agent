import { dedupeCitations } from "@/agentflow/agents/online/content-organizer";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import {
  buildExternalLinksAnswer,
  extractExternalLinksFromHits,
  resolveExternalLinkScope,
} from "./extract-external-links";

export const runExtractExternalLinksFromHits = (input: {
  hits: KnowledgeHit[];
  language: "zh" | "en" | "mixed";
  label: string;
  userQuestion?: string;
  parentUserQuestion?: string;
}): ToolRunResult => {
  const scope = input.userQuestion
    ? resolveExternalLinkScope(input.userQuestion, input.parentUserQuestion)
    : { label: input.label };
  const links = extractExternalLinksFromHits(input.hits, scope);
  const { answer, insufficientEvidence } = buildExternalLinksAnswer({
    links,
    language: input.language,
    scope,
  });
  const citations = dedupeCitations(
    links.slice(0, 6).map((l) => ({ path: l.path, excerpt: l.url }))
  );
  return {
    toolId: "extract_external_links_from_hits",
    label: input.label,
    ok: !insufficientEvidence,
    answer,
    citations,
    hits: input.hits,
    insufficientEvidence,
    confidence: insufficientEvidence ? 0.85 : 0.9,
  };
};
