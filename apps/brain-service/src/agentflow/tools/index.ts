import type { StructuredToolInterface } from "@langchain/core/tools";
import { computeAgeFromHitsTool, getCurrentDateTool } from "./local/identity";
import { listVaultFilesTool, retrieveCorpusTool } from "./local/corpus";
import { searchWebTool } from "./local/web";
import { translateTextTool } from "./local/translate";
import { summarizeTextTool } from "./local/summarize";
import { recallUserFactTool, rememberUserFactTool } from "./local/user-fact";

export {
  getToolContext,
  runWithToolContext,
  type FambrainToolContext,
} from "./context";

export { retrieveCorpusTool, listVaultFilesTool } from "./local/corpus";
export { rememberUserFactTool, recallUserFactTool } from "./local/user-fact";
export { summarizeTextTool } from "./local/summarize";
export { computeAgeFromHitsTool, getCurrentDateTool } from "./local/identity";
export { searchWebTool } from "./local/web";
export { translateTextTool } from "./local/translate";

export {
  ANALYST_FALLBACK_TOOL_IDS,
  FAMBRAIN_TOOL_NAMES,
  IDENTITY_FIELD_BY_ID,
  LANGCHAIN_TOOL_NAMES,
  PIPELINE_TOOL_IMPL,
  PIPELINE_TOOL_TRANSPORT,
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
  type ToolTransport,
} from "./catalog";

export { invokeTool, type InvokeToolContext } from "./invoke";

export {
  MCP_CLIENT_BINDINGS,
  MCP_SERVER_EXPORTS,
  callRegisteredMcpTool,
} from "./mcp";

export {
  ORCHESTRATED_TOOL_IDS,
  resolveOrchestratedTool,
  runOrchestratedSubQuestion,
  type OrchestratedToolId,
} from "./local/orchestrated";

export {
  buildAgeAnswer,
  computeAgeYears,
  extractBirthOrAgeFromHits,
  extractBirthOrAgeFromText,
  isAgeSubQuestion,
  type BirthDate,
} from "./local/identity";

export {
  extractExternalLinksFromHits,
  buildExternalLinksAnswer,
  resolveExternalLinkScope,
  extractExternalLinkEntityTokens,
  runExtractExternalLinksFromHits,
  type ExtractedLink,
  type ExternalLinkScope,
} from "./local/links";

export { runSearchWeb } from "./local/web";
export { runTranslateText } from "./local/translate";
export {
  runComputeAgeFromHits,
  runComputeTenureFromHits,
  runExtractIdentityFromHits,
} from "./local/identity";
export { runRetrieveCorpus } from "./local/corpus";
export { runComposeEnumeration, runListCorpusEntries } from "./local/enumeration";
export {
  runSynthesizeMerge,
  invokeSynthesizeMerge,
  buildSynthesizeMergeResult,
  assertMatchReportAnswer,
  MATCH_REPORT_HEADINGS,
  renderMatchReportMarkdown,
  matchReportToBlocks,
} from "./local/synthesize";

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
