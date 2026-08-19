import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import { callRegisteredMcpTool } from "@/agentflow/tools/mcp/client";

export const runGetWeather = async (input: {
  location: string;
  label: string;
}): Promise<ToolRunResult> => {
  const location = input.location.trim();
  if (!location) {
    return {
      toolId: "get_weather",
      label: input.label,
      ok: false,
      answer: "未提供地点，无法查询天气。",
      citations: [],
      hits: [],
      insufficientEvidence: true,
      confidence: 0.5,
    };
  }

  const called = await callRegisteredMcpTool({
    toolId: "get_weather",
    arguments: { location },
  });
  return {
    toolId: "get_weather",
    label: input.label,
    ok: called.ok,
    answer: called.text,
    citations: [],
    hits: [],
    insufficientEvidence: !called.ok,
    confidence: called.ok ? 0.9 : 0.6,
  };
};
