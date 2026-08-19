export type { TranslateToolResult, TranslateToolStatus } from "./interface";
export { translateTextTool } from "./translate-text";
export { runTranslateText } from "./run";
export {
  legalizeYoudaoSourceLang,
  legalizeYoudaoTargetLang,
} from "./lang";
export {
  isYoudaoTranslateConfigured,
  readYoudaoCredentials,
  translateWithYoudao,
} from "./youdao";
