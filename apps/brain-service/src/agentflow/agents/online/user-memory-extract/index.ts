/**
 * 轮次结束静默自学：原话 → 结构化 facts → Mem0。
 * 包根只聚合；抽取在 extract/，写入在 persist/。
 */

export type {
  ExtractedUserMemoryFact,
  UserMemoryAutoLearnConfig,
  UserMemoryExtractLlmResult,
} from "./interface";
export {
  getUserMemoryAutoLearnConfig,
  resetUserMemoryAutoLearnConfigCache,
} from "./config";
export {
  USER_MEMORY_EXTRACT_PROMPT,
  extractUserMemoryFactsFromUtterance,
  legalizeExtractedUserMemoryFacts,
  parseUserMemoryExtractResult,
} from "./extract";
export { persistUserMemoryAutoLearnAfterTurn } from "./persist";
