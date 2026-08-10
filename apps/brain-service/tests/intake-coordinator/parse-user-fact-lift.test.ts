import { describe, expect, it } from "vitest";
import { parseIntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";

describe("parseIntakeRoutingDecision userFact lift", () => {
  it("aliases intent remember → remember_user_fact and keeps top-level fields", () => {
    const d = parseIntakeRoutingDecision({
      intent: "remember",
      searchQuery: "",
      subTasks: [],
      topics: [],
      language: "zh",
      confidence: 0.9,
      queryType: null,
      clarifyingQuestion: null,
      briefReply: null,
      pathPlan: { steps: [] },
      composeMode: "qa",
      retrievalPlan: [],
      userFactKey: "qq",
      userFactLabel: "QQ号",
      userFactValue: "734858469",
      coreference: "none",
    });
    expect(d?.intent).toBe("remember_user_fact");
    expect(d?.userFactKey).toBe("qq");
    expect(d?.userFactValue).toBe("734858469");
  });

  it("lifts userFact* from set_user_fact params.key/value", () => {
    const d = parseIntakeRoutingDecision({
      intent: "remember",
      searchQuery: "",
      subTasks: [],
      topics: [],
      language: "zh",
      confidence: 0.9,
      queryType: null,
      clarifyingQuestion: null,
      briefReply: null,
      pathPlan: {
        steps: [
          {
            id: "user-fact",
            kind: "set_user_fact",
            label: "QQ号",
            params: { key: "qq", value: "734858469" },
          },
        ],
      },
      composeMode: "qa",
      retrievalPlan: [],
      coreference: "none",
    });
    expect(d?.intent).toBe("remember_user_fact");
    expect(d?.userFactKey).toBe("qq");
    expect(d?.userFactValue).toBe("734858469");
  });

  it("lifts userFact* from mem step params + step.id slug", () => {
    const d = parseIntakeRoutingDecision({
      intent: "remember_user_fact",
      searchQuery: "",
      subTasks: ["记住 QQ 号"],
      topics: ["personal"],
      language: "zh",
      confidence: 0.9,
      queryType: "default",
      clarifyingQuestion: null,
      briefReply: null,
      pathPlan: {
        steps: [
          {
            id: "mem-qq",
            kind: "mem",
            label: "记住 QQ 号",
            searchQuery: "",
            queryType: "default",
            topics: ["personal"],
            params: {
              operation: "remember_user_fact",
              key: "QQ号",
              value: "734858469",
            },
          },
        ],
      },
      composeMode: "qa",
      retrievalPlan: [],
      coreference: "none",
    });
    expect(d?.intent).toBe("remember_user_fact");
    expect(d?.userFactKey).toBe("qq");
    expect(d?.userFactValue).toBe("734858469");
    expect(d?.userFactLabel).toMatch(/QQ/);
  });
});
