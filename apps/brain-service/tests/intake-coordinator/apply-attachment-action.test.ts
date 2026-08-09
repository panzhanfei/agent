import { describe, expect, it } from "vitest";
import {
  applyAttachmentAction,
  parseAttachmentAction,
} from "@/agentflow/agents/online/intake-coordinator/guards";
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";

const baseDecision = (
  patch: Partial<IntakeRoutingDecision> = {}
): IntakeRoutingDecision => ({
  intent: "retrieve_and_answer",
  searchQuery: "看看附件",
  subTasks: [],
  topics: ["attachment"],
  language: "zh",
  confidence: 0.8,
  queryType: "default",
  clarifyingQuestion: null,
  briefReply: null,
  retrievalPlan: [],
  pathPlan: { steps: [] },
  answerOrder: [],
  composeMode: "qa",
  userFactKey: null,
  userFactLabel: null,
  userFactValue: null,
  attachmentAction: null,
  coreference: "none",
  ...patch,
});

const sampleAtt = {
  fileName: "a.md",
  title: "a",
  text: "hello attachment body",
  format: "word",
  textLength: 21,
};

describe("parseAttachmentAction", () => {
  it("accepts known actions", () => {
    expect(parseAttachmentAction("extract")).toBe("extract");
    expect(parseAttachmentAction("SUMMARIZE")).toBe("summarize");
    expect(parseAttachmentAction("nope")).toBeNull();
  });
});

describe("applyAttachmentAction", () => {
  it("clarifies when action missing", async () => {
    const r = await applyAttachmentAction({
      decision: baseDecision(),
      attachments: [sampleAtt],
      actorUserId: "u1",
      corpusUserId: "c1",
    });
    expect(r.earlyExit).toBe(true);
    expect(r.decision.intent).toBe("clarify");
    expect(r.decision.clarifyingQuestion).toMatch(/抽取|总结|翻译|入库/);
  });

  it("extract returns answer early", async () => {
    const r = await applyAttachmentAction({
      decision: baseDecision({ attachmentAction: "extract" }),
      attachments: [sampleAtt],
      actorUserId: "u1",
      corpusUserId: "c1",
    });
    expect(r.earlyExit).toBe(true);
    expect(r.answer).toContain("hello attachment body");
  });

  it("summarize uses empty searchQuery (no KM) and empty pathPlan", async () => {
    const r = await applyAttachmentAction({
      decision: baseDecision({ attachmentAction: "summarize" }),
      attachments: [sampleAtt],
      actorUserId: "u1",
      corpusUserId: "c1",
    });
    expect(r.earlyExit).toBe(false);
    expect(r.decision.intent).toBe("summarize_content");
    expect(r.decision.composeMode).toBe("summarize");
    expect(r.decision.searchQuery).toBe("");
    expect(r.decision.pathPlan?.steps ?? []).toHaveLength(0);
  });

  it("translate without targetLang clarifies", async () => {
    const r = await applyAttachmentAction({
      decision: baseDecision({ attachmentAction: "translate" }),
      attachments: [sampleAtt],
      actorUserId: "u1",
      corpusUserId: "c1",
    });
    expect(r.earlyExit).toBe(true);
    expect(r.decision.intent).toBe("clarify");
  });

  it("translate with targetLang builds tool step", async () => {
    const r = await applyAttachmentAction({
      decision: baseDecision({
        attachmentAction: "translate",
        pathPlan: {
          steps: [
            {
              id: "t",
              kind: "tool",
              label: "译",
              searchQuery: "",
              queryType: "default",
              topics: [],
              toolId: "translate_text",
              targetLang: "en",
            },
          ],
        },
      }),
      attachments: [sampleAtt],
      actorUserId: "u1",
      corpusUserId: "c1",
    });
    expect(r.earlyExit).toBe(false);
    expect(r.decision.pathPlan?.steps[0]?.toolId).toBe("translate_text");
    expect(r.decision.pathPlan?.steps[0]?.targetLang).toBe("en");
  });
});
