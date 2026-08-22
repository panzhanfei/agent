/**
 * schema：本轮 Intake `language` → translate_text 默认目标语。
 * mixed 跟家庭聊天主语 zh；不扫问句口语。
 */
export const defaultTranslateTargetLangFromReplyLanguage = (
  language: "zh" | "en" | "mixed" | null | undefined
): "zh" | "en" => (language === "en" ? "en" : "zh");
