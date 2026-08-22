import { describe, expect, it } from "vitest";
import { pickToolResultForSubQuestion } from "@/agentflow/agents/online/information-analyst/pick-tool-result";
import { buildFallbackAnswer } from "@/agentflow/agents/online/information-analyst/analyze";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";

const weatherRun = (answer = "济南，中国：26°C，多云。"): ToolRunResult => ({
  toolId: "get_weather",
  label: "济南天气",
  ok: true,
  answer,
  citations: [],
  hits: [],
  insufficientEvidence: false,
  confidence: 0.9,
});

describe("pickToolResultForSubQuestion", () => {
  const bag = {
    "slot_tool-weather": weatherRun(),
  };

  it("uses the matching slot key", () => {
    const r = pickToolResultForSubQuestion(
      { userQuestion: "济南天气", slotId: "tool-weather", queryType: "default" },
      bag
    );
    expect(r?.toolId).toBe("get_weather");
    expect(r?.answer).toMatch(/济南/);
  });

  it("does not reuse the only successful standalone tool for another slot", () => {
    const name = pickToolResultForSubQuestion(
      {
        userQuestion: "姓名",
        slotId: "km-name",
        queryType: "identity",
        identityField: "name",
      },
      bag
    );
    const translate = pickToolResultForSubQuestion(
      {
        userQuestion: "翻译eat",
        slotId: "tool-translate",
        queryType: "default",
      },
      bag
    );
    expect(name).toBeNull();
    expect(translate).toBeNull();
  });

  it("still maps a single unscoped weather result when there is no slotId", () => {
    const r = pickToolResultForSubQuestion(
      { userQuestion: "今天济南天气怎么样", queryType: "default" },
      bag
    );
    expect(r?.toolId).toBe("get_weather");
  });

  it("picks free synthesize_merge without match_report headings", () => {
    const synth: ToolRunResult = {
      toolId: "synthesize_merge",
      label: "中英对照",
      ok: true,
      answer: "中：React。\nEN: React.",
      citations: [],
      hits: [],
      insufficientEvidence: false,
      confidence: 0.75,
    };
    expect(
      pickToolResultForSubQuestion(
        { userQuestion: "中英对照", queryType: "default" },
        { synth }
      )?.answer
    ).toMatch(/React/);
    expect(
      pickToolResultForSubQuestion(
        {
          userQuestion: "中英对照",
          slotId: "dag-bilingual",
          facetKey: "dag:dag-bilingual",
          queryType: "default",
        },
        { synth }
      )?.toolId
    ).toBe("synthesize_merge");
  });
});

describe("buildFallbackAnswer multi-slot", () => {
  it("does not fill the whole composite answer with the only weather result", async () => {
    const r = await buildFallbackAnswer({
      userQuestion: "我叫什么，今天济南的天气怎么样，帮我翻译 eat",
      language: "zh",
      subTasks: ["姓名", "济南天气", "翻译eat"],
      hits: [],
      coverage: "none",
      notes: null,
      memoryBlock: null,
      queryType: "identity",
      toolResults: {
        "slot_tool-weather": weatherRun(),
      },
      compositeSubResults: [
        {
          slot: "km-name",
          label: "姓名",
          hits: [],
          coverage: "none",
          dataSource: "corpus",
        },
        {
          slot: "tool-weather",
          label: "济南天气",
          hits: [],
          coverage: "none",
          dataSource: "web",
        },
        {
          slot: "tool-translate",
          label: "翻译eat",
          hits: [],
          coverage: "none",
          dataSource: "web",
        },
      ],
    });
    expect(r.answer).not.toMatch(/济南/);
  });
});
