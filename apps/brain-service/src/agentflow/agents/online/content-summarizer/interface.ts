export type ContentSummaryResult = {
  title: string;
  summary: string;
  bullets: string[];
  keywords: string[];
  language: "zh" | "en" | "mixed";
  notes: string | null;
};

export type ContentSummarizerInput = {
  /** 待摘要正文（Markdown 或纯文本） */
  text: string;
  /** 可选来源说明，如 corpus 路径 */
  sourceLabel?: string | null;
  /** 期望语言 */
  language?: "zh" | "en" | "mixed";
  /** 最多输出几条要点 */
  maxBullets?: number;
};
