import { describe, expect, it } from "vitest";
import {
  IDENTITY_FIELD_BY_ID,
  PIPELINE_TOOL_IMPL,
  TOOL_RUN_IDS,
  invokeTool,
  resolveIdentityFieldFromPlan,
} from "@/agentflow/tools";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";

const hit = (excerpt: string): KnowledgeHit => ({
  path: "personal/resume.md",
  title: "resume",
  excerpt,
  relevance: 1,
});

describe("tools catalog + invoke", () => {
  it("lists every pipeline toolId once", () => {
    expect(Object.keys(PIPELINE_TOOL_IMPL).sort()).toEqual(
      [...TOOL_RUN_IDS].sort()
    );
  });

  it("maps identityField to toolId", () => {
    expect(IDENTITY_FIELD_BY_ID.age.toolId).toBe("compute_age_from_hits");
    expect(
      resolveIdentityFieldFromPlan({ identityField: "tenure" })?.toolId
    ).toBe("compute_tenure_from_hits");
    expect(resolveIdentityFieldFromPlan({})).toBeNull();
  });

  it("invoke extract_identity_from_hits", async () => {
    const result = await invokeTool(
      {
        id: "name",
        label: "姓名",
        dataSource: "corpus",
        toolId: "extract_identity_from_hits",
        field: "name",
        deps: [],
      },
      {
        corpusUserId: "",
        actorUserId: "",
        userQuestion: "姓名",
        asOfDate: "2026-08-19",
        language: "zh",
        hits: [hit("| 姓名 | 潘展飞 |")],
        prior: {},
      }
    );
    expect(result.answer).toBe("潘展飞");
    expect(result.insufficientEvidence).toBe(false);
  });

  it("invoke compute_age_from_hits", async () => {
    const result = await invokeTool(
      {
        id: "age",
        label: "年龄",
        dataSource: "compute",
        toolId: "compute_age_from_hits",
        field: "age",
        deps: [],
      },
      {
        corpusUserId: "",
        actorUserId: "",
        userQuestion: "我今年多大",
        asOfDate: "2026-07-09",
        language: "zh",
        hits: [hit("| 出生日期 | 1993.03 |")],
        prior: {},
      }
    );
    expect(result.answer).toMatch(/33\s*岁/);
    expect(result.insufficientEvidence).toBe(false);
  });
});
