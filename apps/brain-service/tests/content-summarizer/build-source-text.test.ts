import { describe, expect, it } from "vitest";
import { buildSummarizeSourceText } from "@/agentflow/agents/online/content-summarizer/source";

describe("buildSummarizeSourceText", () => {
  it("prefers turnAttachments over empty hits / short question", () => {
    const { text, sourceLabel } = buildSummarizeSourceText({
      userQuestion: "帮我总结这个图片内容",
      decision: {
        intent: "summarize_content",
        searchQuery: "",
        subTasks: [],
        topics: [],
        language: "zh",
        confidence: 0.9,
        queryType: null,
        clarifyingQuestion: null,
        briefReply: null,
        retrievalPlan: [],
        userFactKey: null,
        userFactLabel: null,
        userFactValue: null,
      },
      hits: [],
      turnAttachments: [
        {
          fileName: "React18.png",
          title: "React18源码",
          text: "react/packages shared react-dom reconciler scheduler",
        },
      ],
    });
    expect(text).toContain("react/packages");
    expect(text).not.toBe("帮我总结这个图片内容");
    expect(sourceLabel).toContain("React18");
  });
});
