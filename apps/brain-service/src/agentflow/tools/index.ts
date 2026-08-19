import type { StructuredToolInterface } from "@langchain/core/tools";
import { computeAgeFromHitsTool, getCurrentDateTool } from "./identity";
import { listVaultFilesTool, retrieveCorpusTool } from "./corpus";
import { searchWebTool } from "./web";
import { translateTextTool } from "./translate";
import { summarizeTextTool } from "./summarize";
import { recallUserFactTool, rememberUserFactTool } from "./user-fact";

export {
  getToolContext,
  runWithToolContext,
  type FambrainToolContext,
} from "./context";

export { retrieveCorpusTool, listVaultFilesTool } from "./corpus";
export { rememberUserFactTool, recallUserFactTool } from "./user-fact";
export { summarizeTextTool } from "./summarize";
export { computeAgeFromHitsTool, getCurrentDateTool } from "./identity";
export { searchWebTool } from "./web";
export { translateTextTool } from "./translate";

export {
  ANALYST_FALLBACK_TOOL_IDS,
  FAMBRAIN_TOOL_NAMES,
  IDENTITY_FIELD_BY_ID,
  LANGCHAIN_TOOL_NAMES,
  PIPELINE_TOOL_IMPL,
  POST_RETRIEVAL_TOOL_IDS,
  TOOL_RUN_IDS,
  isPostRetrievalToolId,
  resolveIdentityField,
  resolveIdentityFieldFromPlan,
  type AnalystFallbackToolId,
  type IdentityFieldSpec,
  type LangchainToolName,
  type PostRetrievalToolId,
  type ToolRunId,
} from "./catalog";

export { invokeTool, type InvokeToolContext } from "./invoke";

export {
  ORCHESTRATED_TOOL_IDS,
  resolveOrchestratedTool,
  runOrchestratedSubQuestion,
  type OrchestratedToolId,
} from "./orchestrated";

export {
  buildAgeAnswer,
  computeAgeYears,
  extractBirthOrAgeFromHits,
  extractBirthOrAgeFromText,
  isAgeSubQuestion,
  type BirthDate,
} from "./identity";

export {
  extractExternalLinksFromHits,
  buildExternalLinksAnswer,
  resolveExternalLinkScope,
  extractExternalLinkEntityTokens,
  runExtractExternalLinksFromHits,
  type ExtractedLink,
  type ExternalLinkScope,
} from "./links";

export { runSearchWeb } from "./web";
export { runTranslateText } from "./translate";
export {
  runComputeAgeFromHits,
  runComputeTenureFromHits,
  runExtractIdentityFromHits,
} from "./identity";
export { runRetrieveCorpus } from "./corpus";
export { runComposeEnumeration, runListCorpusEntries } from "./enumeration";
export {
  runSynthesizeMerge,
  invokeSynthesizeMerge,
  buildSynthesizeMergeResult,
  assertMatchReportAnswer,
  MATCH_REPORT_HEADINGS,
  renderMatchReportMarkdown,
  matchReportToBlocks,
} from "./synthesize";

/** FamBrain 在线能力对应的 LangChain StructuredTool（主 pipeline 仍走 invoke(toolId)） */
export const createFambrainTools = (): StructuredToolInterface[] => [
  retrieveCorpusTool,
  computeAgeFromHitsTool,
  rememberUserFactTool,
  recallUserFactTool,
  listVaultFilesTool,
  summarizeTextTool,
  searchWebTool,
  translateTextTool,
  getCurrentDateTool,
];
