/**
 * 本地 tool 实现：identity / corpus / web / translate / …
 */
export type { LocalToolFolder } from "./interface";

export {
  IDENTITY_CORPUS_FIELD_LABELS,
  buildAgeAnswer,
  computeAgeFromHitsTool,
  computeAgeYears,
  extractBirthOrAgeFromHits,
  extractBirthOrAgeFromText,
  extractTenureFromHits,
  getCurrentDateTool,
  isAgeSubQuestion,
  runComputeAgeFromHits,
  runComputeTenureFromHits,
  runExtractIdentityFromHits,
  type BirthDate,
} from "./identity";

export {
  listVaultFilesTool,
  retrieveCorpusTool,
  runRetrieveCorpus,
} from "./corpus";

export { runSearchWeb, searchWebTool } from "./web";
export { runTranslateText, translateTextTool } from "./translate";
export {
  buildExternalLinksAnswer,
  extractExternalLinkEntityTokens,
  extractExternalLinksFromHits,
  resolveExternalLinkScope,
  runExtractExternalLinksFromHits,
  type ExtractedLink,
  type ExternalLinkScope,
} from "./links";
export { runComposeEnumeration, runListCorpusEntries } from "./enumeration";
export {
  assertMatchReportAnswer,
  buildSynthesizeMergeResult,
  invokeSynthesizeMerge,
  MATCH_REPORT_HEADINGS,
  matchReportToBlocks,
  renderMatchReportMarkdown,
  runSynthesizeMerge,
} from "./synthesize";
export { summarizeTextTool } from "./summarize";
export { recallUserFactTool, rememberUserFactTool } from "./user-fact";
export {
  ORCHESTRATED_TOOL_IDS,
  resolveOrchestratedTool,
  runOrchestratedSubQuestion,
  type OrchestratedToolId,
} from "./orchestrated";

export { runGetWeather } from "./weather";
