import { buildSynthesizeMergeResult } from "./build";

export type {
  MatchReport,
  MatchReportConclusion,
  MatchReportEvidenceGrade,
  MatchReportItem,
} from "./interface";
export {
  MATCH_REPORT_CONCLUSIONS,
  MATCH_REPORT_EVIDENCE_GRADES,
  MATCH_REPORT_HEADINGS,
} from "./interface";
export {
  assertMatchReportAnswer,
  buildDeterministicMatchReport,
  matchReportSchema,
  matchReportToBlocks,
  parseMatchReport,
  renderMatchReportMarkdown,
} from "./match-report";
export { fillFreeSynthesisWithLlm, fillMatchReportWithLlm } from "./fill-llm";
export { buildSynthesizeMergeResult } from "./build";

/** 编排层入口：synthesize_merge */
export const runSynthesizeMerge = buildSynthesizeMergeResult;
export const invokeSynthesizeMerge = buildSynthesizeMergeResult;
