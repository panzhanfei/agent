import { describe, expect, it } from "vitest";
import {
  decisionSuggestsHybridDag,
  topicsSuggestWebSource,
} from "@/agentflow/agents/online/intake-coordinator";
import { resolveIdentityFieldFromPlan } from "@/agentflow/agents/online/tool-orchestrator";

describe("field-catalog", () => {
  it("resolves age from identityField", () => {
    const field = resolveIdentityFieldFromPlan({ identityField: "age" });
    expect(field?.id).toBe("age");
    expect(field?.toolId).toBe("compute_age_from_hits");
  });

  it("resolves birthYear from identityField", () => {
    const field = resolveIdentityFieldFromPlan({
      identityField: "birthYear",
    });
    expect(field?.id).toBe("birthYear");
    expect(field?.toolId).toBe("extract_identity_from_hits");
  });

  it("returns null without identityField", () => {
    expect(resolveIdentityFieldFromPlan({})).toBeNull();
  });

  it("web source from topics.external", () => {
    expect(topicsSuggestWebSource(["external", "project"])).toBe(true);
    expect(topicsSuggestWebSource(["personal", "resume"])).toBe(false);
  });

  it("hybrid dag from external + corpus topics", () => {
    expect(
      decisionSuggestsHybridDag({
        topics: ["personal", "external"],
      })
    ).toBe(true);
    expect(
      decisionSuggestsHybridDag({
        topics: ["project"],
      })
    ).toBe(false);
  });
});
