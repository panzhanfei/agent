import { describe, expect, it } from "vitest";
import { buildFallbackAnswer } from "@/agentflow/agents/online/information-analyst/analyze";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";

const weatherRun = (answer: string): ToolRunResult => ({
  toolId: "get_weather",
  label: "天水天气",
  ok: true,
  answer,
  citations: [],
  hits: [],
  insufficientEvidence: false,
  confidence: 0.9,
});

describe("analyst fallback uses standalone weather tool", () => {
  it("empty hits still answers from get_weather slot", async () => {
    const r = await buildFallbackAnswer({
      userQuestion: "今天天水的天水的天气如何",
      language: "zh",
      subTasks: ["天水天气"],
      hits: [],
      coverage: "none",
      notes: "天水，中国：20°C，晴，风速 4 km/h。数据来源 Open-Meteo（CC BY 4.0）。",
      memoryBlock: null,
      queryType: "default",
      toolResults: {
        "slot_tool-weather": weatherRun(
          "天水，中国：20°C，晴，风速 4 km/h。数据来源 Open-Meteo（CC BY 4.0）。"
        ),
      },
      compositeSubResults: [
        {
          slot: "tool-weather",
          label: "天水天气",
          hits: [],
          coverage: "none",
          dataSource: "web",
        },
      ],
    });
    expect(r.insufficientEvidence).toBe(false);
    expect(r.answer).toMatch(/天水.*20°C/);
    expect(r.answer).not.toMatch(/没有检索到/);
  });
});
