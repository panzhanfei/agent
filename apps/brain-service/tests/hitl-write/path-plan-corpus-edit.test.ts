import { describe, expect, it } from "vitest";
import {
  deriveCompositeSlotsFromPathPlan,
  legalizePathPlan,
  stepsOfKind,
} from "@/agentflow/agents/online/intake-coordinator";

describe("pathPlan corpus_edit", () => {
  it("legalizes corpus_edit + params and maps executor", () => {
    const plan = legalizePathPlan({
      steps: [
        {
          id: "edit-1",
          kind: "corpus_edit",
          label: "修订 profile",
          searchQuery: "personal/profile.md",
          queryType: "default",
          topics: ["personal"],
          params: {
            targetPath: "personal/profile.md",
            operation: "update",
            afterContent: "# hi\n",
          },
        },
      ],
    });
    expect(stepsOfKind(plan, "corpus_edit")).toHaveLength(1);
    expect(plan.steps[0]?.params?.targetPath).toBe("personal/profile.md");
    const slots = deriveCompositeSlotsFromPathPlan(plan);
    expect(slots).toHaveLength(1);
    expect(slots[0]?.executor).toBe("corpus_edit");
    expect(slots[0]?.params?.operation).toBe("update");
  });

  it("drops corpus_edit without targetPath", () => {
    const plan = legalizePathPlan({
      steps: [
        {
          id: "edit-bad",
          kind: "corpus_edit",
          label: "坏步",
          searchQuery: "",
          queryType: "default",
          topics: [],
          params: { operation: "update" },
        },
      ],
    });
    expect(stepsOfKind(plan, "corpus_edit")).toHaveLength(0);
  });
});
