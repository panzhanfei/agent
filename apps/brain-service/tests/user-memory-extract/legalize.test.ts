import { describe, expect, it } from "vitest";
import { legalizeExtractedUserMemoryFacts } from "@/agentflow/agents/online/user-memory-extract";

describe("legalizeExtractedUserMemoryFacts", () => {
  it("keeps high-confidence structured facts and normalizes factKey", () => {
    const facts = legalizeExtractedUserMemoryFacts(
      {
        facts: [
          {
            factKey: "My QQ",
            label: "QQ",
            value: "123456",
            confidence: 0.91,
          },
        ],
      },
      0.85
    );
    expect(facts).toEqual([
      {
        factKey: "my_qq",
        label: "QQ",
        value: "123456",
        confidence: 0.91,
      },
    ]);
  });

  it("drops below threshold / missing fields / duplicates", () => {
    const facts = legalizeExtractedUserMemoryFacts(
      {
        facts: [
          { factKey: "a", label: "A", value: "1", confidence: 0.5 },
          { factKey: "b", label: "", value: "2", confidence: 0.99 },
          { factKey: "c", label: "C", value: "3", confidence: 0.9 },
          { factKey: "c", label: "C", value: "3", confidence: 0.95 },
        ],
      },
      0.85
    );
    expect(facts).toEqual([
      { factKey: "c", label: "C", value: "3", confidence: 0.9 },
    ]);
  });
});
