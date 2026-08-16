/**
 * hybrid synthesize_merge：匹配结构化（MatchReport）契约。
 * 展示四栏 + 枚举结论；禁止纯散文替代结论栏。
 */

export const MATCH_REPORT_CONCLUSIONS = [
  "适合",
  "谨慎",
  "信息不足",
] as const;

export type MatchReportConclusion = (typeof MATCH_REPORT_CONCLUSIONS)[number];

export const MATCH_REPORT_EVIDENCE_GRADES = [
  "sufficient",
  "partial",
  "insufficient",
] as const;

export type MatchReportEvidenceGrade =
  (typeof MATCH_REPORT_EVIDENCE_GRADES)[number];

export type MatchReportItem = {
  text: string;
  /** 可选证据摘录（来自语料 path 或 web url） */
  evidence?: string | null;
};

export type MatchReport = {
  matches: MatchReportItem[];
  gaps: MatchReportItem[];
  risks: MatchReportItem[];
  conclusion: MatchReportConclusion;
  evidenceGrade: MatchReportEvidenceGrade;
  sourcesUsed: Array<"corpus" | "web">;
  openQuestions?: string[];
};

/** L1 固定四级标题（eval / 渲染共用） */
export const MATCH_REPORT_HEADINGS = {
  matches: "## 匹配点",
  gaps: "## 缺口",
  risks: "## 风险/不确定",
  conclusion: "## 结论",
} as const;
