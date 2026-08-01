export type { TranslateToolResult, TranslateToolStatus } from "./interface";
export { translateTextTool } from "./translate-text";
export {
  legalizeYoudaoSourceLang,
  legalizeYoudaoTargetLang,
} from "./lang";
export {
  isYoudaoTranslateConfigured,
  readYoudaoCredentials,
  translateWithYoudao,
} from "./youdao";
