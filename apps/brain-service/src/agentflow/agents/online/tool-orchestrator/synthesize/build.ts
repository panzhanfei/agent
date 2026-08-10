import { dedupeCitations } from "@/agentflow/agents/online/content-organizer";
import type { ToolRunResult } from "../interface";
import { fillMatchReportWithLlm } from "./fill-llm";
import {
  buildDeterministicMatchReport,
  matchReportToBlocks,
  renderMatchReportMarkdown,
} from "./match-report";
import type { MatchReport } from "./interface";

export const buildSynthesizeMergeResult = async (input: {
  label: string;
  deps: ToolRunResult[];
  userQuestion?: string;
}): Promise<ToolRunResult & { matchReport: MatchReport }> => {
  const deterministic = buildDeterministicMatchReport(input);
  let report = deterministic.report;

  const llmReport = await fillMatchReportWithLlm(input);
  if (llmReport) {
    // LLM 结论不得在证据不足时标「适合」
    if (
      deterministic.report.evidenceGrade === "insufficient" &&
      llmReport.conclusion === "适合"
    ) {
      report = {
        ...llmReport,
        conclusion: "信息不足",
        evidenceGrade: "insufficient",
        sourcesUsed: deterministic.report.sourcesUsed,
      };
    } else {
      report = {
        ...llmReport,
        sourcesUsed:
          llmReport.sourcesUsed.length > 0
            ? llmReport.sourcesUsed
            : deterministic.report.sourcesUsed,
      };
    }
  }

  const answer = renderMatchReportMarkdown(report);
  const citations = dedupeCitations(deterministic.citations);
  const insufficient =
    report.evidenceGrade === "insufficient" ||
    report.conclusion === "信息不足";

  return {
    toolId: "synthesize_merge",
    label: input.label,
    ok: !insufficient || report.matches.length + report.gaps.length > 0,
    answer,
    citations,
    hits: input.deps.find((d) => d.toolId === "retrieve_corpus")?.hits ?? [],
    blocks: matchReportToBlocks(report),
    insufficientEvidence: insufficient,
    confidence:
      report.evidenceGrade === "sufficient"
        ? 0.82
        : report.evidenceGrade === "partial"
          ? 0.72
          : 0.55,
    matchReport: report,
  };
};
