import type { StructuredToolInterface } from "@langchain/core/tools";
import { computeAgeFromHitsTool, getCurrentDateTool } from "./identity";
import { listVaultFilesTool, retrieveCorpusTool } from "./corpus";
import { searchWebTool } from "./web";
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
  type ExtractedLink,
  type ExternalLinkScope,
} from "./links";

/** FamBrain 在线能力对应的 LangChain StructuredTool（主 pipeline 仍走 LangGraph 编排节点 + orchestrated 工具表） */
export const createFambrainTools = (): StructuredToolInterface[] => [
  retrieveCorpusTool,
  computeAgeFromHitsTool,
  rememberUserFactTool,
  recallUserFactTool,
  listVaultFilesTool,
  summarizeTextTool,
  searchWebTool,
  getCurrentDateTool,
];

export const FAMBRAIN_TOOL_NAMES = [
  "retrieve_corpus",
  "compute_age_from_hits",
  "remember_user_fact",
  "recall_user_fact",
  "list_vault_files",
  "summarize_text",
  "search_web",
  "get_current_date",
] as const;
