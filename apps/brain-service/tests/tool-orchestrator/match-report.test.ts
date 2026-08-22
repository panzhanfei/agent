import { describe, expect, it } from "vitest";
import {
  assertMatchReportAnswer,
  buildDeterministicMatchReport,
  buildSynthesizeMergeResult,
  MATCH_REPORT_HEADINGS,
  parseMatchReport,
  renderMatchReportMarkdown,
  type ToolRunResult,
} from "@/agentflow/agents/online/tool-orchestrator";

process.env.SYNTHESIZE_MATCH_LLM = "0";

const resume = (): ToolRunResult => ({
  toolId: "retrieve_corpus",
  label: "个人简历",
  ok: true,
  answer: "React/TypeScript 前端\n带过小团队",
  citations: [{ path: "personal/简历.md", excerpt: "React" }],
  hits: [],
  insufficientEvidence: false,
  confidence: 0.8,
});

const web = (): ToolRunResult => ({
  toolId: "search_web",
  label: "目标公司",
  ok: true,
  answer: "云计算与 ToG 业务\n招聘前端负责人",
  citations: [{ path: "https://example.com", excerpt: "云计算" }],
  hits: [],
  insufficientEvidence: false,
  confidence: 0.7,
});

describe("MatchReport（匹配结构化 L1～L5）", () => {
  it("deterministic：双源 → 四栏 + 谨慎", () => {
    const { report } = buildDeterministicMatchReport({
      label: "综合评估",
      deps: [resume(), web()],
    });
    expect(report.conclusion).toBe("谨慎");
    expect(report.evidenceGrade).toBe("partial");
    expect(report.sourcesUsed).toEqual(expect.arrayContaining(["corpus", "web"]));
    const md = renderMatchReportMarkdown(report);
    expect(assertMatchReportAnswer(md)).toEqual([]);
    for (const h of Object.values(MATCH_REPORT_HEADINGS)) {
      expect(md).toContain(h);
    }
  });

  it("deterministic：缺 web → 信息不足", () => {
    const { report } = buildDeterministicMatchReport({
      label: "综合评估",
      deps: [resume()],
    });
    expect(report.conclusion).toBe("信息不足");
    expect(report.evidenceGrade).toBe("insufficient");
  });

  it("zod 拒绝非法 conclusion", () => {
    expect(
      parseMatchReport({
        matches: [],
        gaps: [],
        risks: [],
        conclusion: "我觉得还行",
        evidenceGrade: "partial",
        sourcesUsed: ["corpus"],
      })
    ).toBeNull();
  });

  it("buildSynthesizeMergeResult 写入 matchReport + blocks", async () => {
    const result = await buildSynthesizeMergeResult({
      label: "综合评估",
      deps: [resume(), web()],
      schema: "match_report",
    });
    expect(result.toolId).toBe("synthesize_merge");
    expect(result.matchReport?.conclusion).toBe("谨慎");
    expect(result.blocks?.length).toBeGreaterThan(0);
    expect(assertMatchReportAnswer(result.answer)).toEqual([]);
  });

  it("free schema joins deps and does not emit match report", async () => {
    const result = await buildSynthesizeMergeResult({
      label: "是否适合出门",
      deps: [
        {
          toolId: "get_weather",
          label: "天水天气",
          ok: true,
          answer: "天水，中国：28°C，多云。",
          citations: [],
          hits: [],
          insufficientEvidence: false,
          confidence: 0.9,
        },
      ],
      schema: "free",
    });
    expect(result.matchReport).toBeUndefined();
    expect(result.answer).toMatch(/28°C/);
    expect(result.answer).not.toMatch(/## 匹配点/);
  });
});
