import { describe, expect, it } from "vitest";
import {
  IDENTITY_FIELD_BY_ID,
  MCP_CLIENT_BINDINGS,
  MCP_CLIENT_SERVERS,
  MCP_SERVER_EXPORTS,
  PIPELINE_TOOL_IMPL,
  PIPELINE_TOOL_TRANSPORT,
  TOOL_RUN_IDS,
  callRegisteredMcpTool,
  invokeTool,
  resolveIdentityFieldFromPlan,
} from "@/agentflow/tools";
import { formatOpenMeteoAnswer } from "@/agentflow/tools/mcp/server";
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
    expect(Object.keys(PIPELINE_TOOL_TRANSPORT).sort()).toEqual(
      [...TOOL_RUN_IDS].sort()
    );
  });

  it("registers get_weather as MCP transport with a whitelist binding", () => {
    expect(PIPELINE_TOOL_TRANSPORT.get_weather).toBe("mcp");
    expect(
      TOOL_RUN_IDS.filter((id) => PIPELINE_TOOL_TRANSPORT[id] === "mcp")
    ).toEqual(["get_weather"]);
    expect(MCP_CLIENT_BINDINGS).toEqual([
      {
        toolId: "get_weather",
        serverId: "open-meteo",
        remoteToolName: "get_current_weather",
      },
    ]);
    expect(MCP_CLIENT_SERVERS.map((s) => s.id)).toEqual(["open-meteo"]);
    expect(MCP_SERVER_EXPORTS).toEqual(["get_current_weather"]);
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

  it("MCP client refuses unregistered toolId", async () => {
    const called = await callRegisteredMcpTool({
      toolId: "search_web",
      arguments: { query: "x" },
    });
    expect(called.ok).toBe(false);
    expect(called.text).toMatch(/未登记 MCP 绑定/);
  });

  it("invoke get_weather without location is insufficient", async () => {
    const result = await invokeTool(
      {
        id: "w",
        label: "天气",
        dataSource: "web",
        toolId: "get_weather",
        searchQuery: "  ",
        deps: [],
      },
      {
        corpusUserId: "",
        actorUserId: "",
        userQuestion: "今天天气怎么样",
        asOfDate: "2026-08-19",
        language: "zh",
        hits: [],
        prior: {},
      }
    );
    expect(result.ok).toBe(false);
    expect(result.insufficientEvidence).toBe(true);
    expect(result.answer).toMatch(/未提供地点/);
  });

  it("formats Open-Meteo current weather", () => {
    expect(
      formatOpenMeteoAnswer({
        place: {
          name: "北京",
          latitude: 39.9,
          longitude: 116.4,
          country: "中国",
        },
        current: { temperatureC: 28.2, windKmh: 10, weatherCode: 0 },
      })
    ).toMatch(/北京.*28°C.*晴/);
  });

  it(
    "MCP client calls registered get_weather",
    async () => {
      const called = await callRegisteredMcpTool({
        toolId: "get_weather",
        arguments: { location: "北京" },
      });
      expect(called.text).not.toMatch(/未登记 MCP/);
      if (!called.ok) {
        expect(called.text.length).toBeGreaterThan(0);
        return;
      }
      expect(called.text).toMatch(/Open-Meteo/);
    },
    30_000
  );
});
