import { dedupeCitations } from "@/agentflow/agents/online/content-organizer";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import type { SynthesizeSchema } from "@/agentflow/agents/online/intake-coordinator/path-plan";
import {
  fillFreeSynthesisWithLlm,
  fillMatchReportWithLlm,
} from "./fill-llm";
import {
  buildDeterministicMatchReport,
  matchReportToBlocks,
  renderMatchReportMarkdown,
} from "./match-report";
import type { MatchReport } from "./interface";

const joinDepAnswers = (deps: ToolRunResult[]): string => {
  const parts = deps
    .filter((d) => d.ok && d.answer.trim())
    .map((d) => `【${d.label}】\n${d.answer.trim()}`);
  return parts.join("\n\n");
};

const buildFreeSynthesizeResult = async (input: {
  label: string;
  deps: ToolRunResult[];
  userQuestion?: string;
}): Promise<ToolRunResult> => {
  const fallback = joinDepAnswers(input.deps);
  const llm = await fillFreeSynthesisWithLlm(input);
  const answer =
    llm?.trim() ||
    fallback ||
    (input.userQuestion?.trim()
      ? `材料不足，无法综合「${input.label}」。`
      : "材料不足，无法综合。");
  const citations = dedupeCitations(
    input.deps.flatMap((d) => d.citations ?? [])
  );
  const anyOk = input.deps.some((d) => d.ok && d.answer.trim());
  return {
    toolId: "synthesize_merge",
    label: input.label,
    ok: anyOk || Boolean(llm?.trim()),
    answer,
    citations,
    hits: input.deps.find((d) => d.hits?.length)?.hits ?? [],
    insufficientEvidence: !anyOk,
    confidence: anyOk ? 0.75 : 0.45,
  };
};

export const buildSynthesizeMergeResult = async (input: {
  label: string;
  deps: ToolRunResult[];
  userQuestion?: string;
  schema?: SynthesizeSchema;
}): Promise<ToolRunResult & { matchReport?: MatchReport }> => {
  const schema = input.schema === "match_report" ? "match_report" : "free";
  if (schema !== "match_report") {
    return buildFreeSynthesizeResult(input);
  }

  const deterministic = buildDeterministicMatchReport(input);
  let report = deterministic.report;

  const llmReport = await fillMatchReportWithLlm(input);
  if (llmReport) {
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
