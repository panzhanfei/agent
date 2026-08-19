/** 翻译工具结构化结果（与 search_web JSON 形态对齐） */
export type TranslateToolStatus = "ok" | "disabled" | "error" | "empty";

export type TranslateToolResult = {
  status: TranslateToolStatus;
  text: string;
  targetLang: string;
  sourceLang: string;
  translation?: string;
  message?: string;
  provider?: string;
};
