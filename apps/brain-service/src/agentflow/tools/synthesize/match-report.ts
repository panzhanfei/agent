import { z } from "zod";
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import type { Citation } from "@/agentflow/agents/online/information-analyst/prompt";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import {
  MATCH_REPORT_CONCLUSIONS,
  MATCH_REPORT_EVIDENCE_GRADES,
  MATCH_REPORT_HEADINGS,
  type MatchReport,
  type MatchReportItem,
} from "./interface";

const itemSchema = z.object({
  text: z.string().min(1),
  evidence: z.string().nullable().optional(),
});

export const matchReportSchema = z.object({
  matches: z.array(itemSchema).default([]),
  gaps: z.array(itemSchema).default([]),
  risks: z.array(itemSchema).default([]),
  conclusion: z.enum(MATCH_REPORT_CONCLUSIONS),
  evidenceGrade: z.enum(MATCH_REPORT_EVIDENCE_GRADES),
  sourcesUsed: z.array(z.enum(["corpus", "web"])).default([]),
  openQuestions: z.array(z.string()).optional(),
});

export const parseMatchReport = (raw: unknown): MatchReport | null => {
  const parsed = matchReportSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
};

const bullet = (items: MatchReportItem[]): string => {
  if (items.length === 0) return "- （无）";
  return items
    .map((it) => {
      const ev = it.evidence?.trim();
      return ev ? `- ${it.text}（证据：${ev.slice(0, 120)}）` : `- ${it.text}`;
    })
    .join("\n");
};

/** L1：固定四栏 Markdown，禁止用散文替代结论栏 */
export const renderMatchReportMarkdown = (report: MatchReport): string => {
  const h = MATCH_REPORT_HEADINGS;
  const open =
    report.openQuestions && report.openQuestions.length > 0
      ? `\n\n### 待澄清\n${report.openQuestions.map((q) => `- ${q}`).join("\n")}`
      : "";
  return [
    h.matches,
    "",
    bullet(report.matches),
    "",
    h.gaps,
    "",
    bullet(report.gaps),
    "",
    h.risks,
    "",
    bullet(report.risks),
    "",
    h.conclusion,
    "",
    report.conclusion,
    open,
  ]
    .join("\n")
    .trim();
};

export const matchReportToBlocks = (
  report: MatchReport
): AssistantMessageBlock[] => [
  { type: "text", markdown: renderMatchReportMarkdown(report) },
];

/** 校验答案是否满足匹配结构化 L1（供 eval） */
export const assertMatchReportAnswer = (answer: string): string[] => {
  const issues: string[] = [];
  const a = answer ?? "";
  for (const heading of Object.values(MATCH_REPORT_HEADINGS)) {
    if (!a.includes(heading)) {
      issues.push(`缺少标题「${heading}」`);
    }
  }
  if (!MATCH_REPORT_CONCLUSIONS.some((c) => new RegExp(`^${c}$`, "m").test(a) || a.includes(`\n${c}`))) {
    // 结论栏后单独一行或文末出现枚举值
    const after = a.split(MATCH_REPORT_HEADINGS.conclusion)[1] ?? "";
    if (!MATCH_REPORT_CONCLUSIONS.some((c) => after.includes(c))) {
      issues.push("结论栏缺少枚举值（适合|谨慎|信息不足）");
    }
  }
  return issues;
};

const clip = (s: string, n: number): string =>
  s.length > n ? `${s.slice(0, n)}…` : s;

const firstLines = (text: string, max = 3): string[] =>
  text
    .split(/\n+/)
    .map((l) => l.replace(/^[\s*#\d.)-]+/, "").trim())
    .filter((l) => l.length >= 4)
    .slice(0, max);

/**
 * 无 LLM 时的确定性 MatchReport（保证契约；结论偏保守）。
 * 有语料+外网 → partial/谨慎；缺一侧 → 信息不足。
 */
export const buildDeterministicMatchReport = (input: {
  label: string;
  deps: ToolRunResult[];
}): { report: MatchReport; citations: Citation[] } => {
  const resume = input.deps.find((d) => d.toolId === "retrieve_corpus");
  const webs = input.deps.filter((d) => d.toolId === "search_web" && d.ok && d.answer?.trim());
  const sourcesUsed: Array<"corpus" | "web"> = [];
  if (resume?.answer?.trim()) sourcesUsed.push("corpus");
  if (webs.length > 0) sourcesUsed.push("web");

  const citations: Citation[] = [];
  for (const d of input.deps) {
    citations.push(...(d.citations ?? []));
  }

  const matches: MatchReportItem[] = [];
  const gaps: MatchReportItem[] = [];
  const risks: MatchReportItem[] = [];
  const openQuestions: string[] = [];

  if (resume?.answer?.trim()) {
    for (const line of firstLines(resume.answer, 3)) {
      matches.push({
        text: `履历侧要点：${clip(line, 80)}`,
        evidence: resume.citations[0]?.path ?? "corpus",
      });
    }
  } else {
    gaps.push({ text: "缺少可用的个人履历/语料摘要，无法对照岗位或公司要求。" });
    risks.push({ text: "语料检索未返回有效内容。" });
  }

  if (webs.length > 0) {
    for (const w of webs) {
      for (const line of firstLines(w.answer, 2)) {
        matches.push({
          text: `${w.label}：${clip(line, 80)}`,
          evidence: w.citations[0]?.path ?? w.label,
        });
      }
    }
  } else {
    gaps.push({ text: "缺少目标公司/市场外网材料，无法完成双向匹配。" });
    risks.push({ text: "外网检索未就绪或未返回有效内容（soft 依赖可能已降级）。" });
    openQuestions.push("补充目标公司业务/招聘要求后再评估。");
  }

  if (sourcesUsed.length < 2) {
    const report: MatchReport = {
      matches,
      gaps,
      risks,
      conclusion: "信息不足",
      evidenceGrade: "insufficient",
      sourcesUsed,
      openQuestions,
    };
    return { report, citations };
  }

  risks.push({
    text: "本报告由结构化模板生成；细项匹配需以原文证据为准，勿外推未出现的事实。",
  });
  if (matches.length < 2) {
    gaps.push({ text: "可对齐的匹配点偏少，建议补充更具体的岗位/JD 描述。" });
  }

  const report: MatchReport = {
    matches,
    gaps,
    risks,
    conclusion: "谨慎",
    evidenceGrade: "partial",
    sourcesUsed,
    openQuestions:
      openQuestions.length > 0
        ? openQuestions
        : ["若有具体岗位 JD，可再对照技能与年限做精匹配。"],
  };
  return { report, citations };
};
