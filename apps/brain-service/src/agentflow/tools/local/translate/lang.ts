/**
 * 目标语合法化：小表映射到有道码；非法 → null（不猜口语）。
 */
const TARGET_LANG_MAP: Record<string, string> = {
  zh: "zh-CHS",
  "zh-cn": "zh-CHS",
  "zh-chs": "zh-CHS",
  "zh-hans": "zh-CHS",
  "zh-tw": "zh-CHT",
  "zh-cht": "zh-CHT",
  "zh-hant": "zh-CHT",
  en: "en",
  ja: "ja",
  ko: "ko",
  fr: "fr",
  de: "de",
  es: "es",
  ru: "ru",
  pt: "pt",
  it: "it",
  vi: "vi",
  th: "th",
  id: "id",
  ar: "ar",
};

/** Intake/槽 targetLang → 有道 to 码；非法返回 null */
export const legalizeYoudaoTargetLang = (
  raw: string | null | undefined
): string | null => {
  const t = raw?.trim();
  if (!t) return null;
  const mapped = TARGET_LANG_MAP[t.toLowerCase()];
  if (mapped) return mapped;
  // 已是有道码（大小写敏感子集）
  if (t === "zh-CHS" || t === "zh-CHT") return t;
  const lower = t.toLowerCase();
  if (TARGET_LANG_MAP[lower]) return TARGET_LANG_MAP[lower]!;
  return null;
};

/** 源语：空 / auto → auto；其余走同一小表，非法则 auto */
export const legalizeYoudaoSourceLang = (
  raw: string | null | undefined
): string => {
  const t = raw?.trim();
  if (!t || t.toLowerCase() === "auto") return "auto";
  return legalizeYoudaoTargetLang(t) ?? "auto";
};
