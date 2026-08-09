import { describe, expect, it } from "vitest";
import {
  deriveCompositeSlotsFromPathPlan,
  legalizePathPlan,
  stepsOfKind,
} from "@/agentflow/agents/online/intake-coordinator";

describe("pathPlan corpus_edit (retired)", () => {
  it("drops all corpus_edit steps", () => {
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
        {
          id: "open-1",
          kind: "corpus_edit",
          label: "打开",
          searchQuery: "personal/_x.md",
          queryType: "default",
          topics: ["personal"],
          params: {
            targetPath: "personal/_x.md",
            operation: "open",
            afterContent: "",
          },
        },
      ],
    });
    expect(stepsOfKind(plan, "corpus_edit")).toHaveLength(0);
    expect(deriveCompositeSlotsFromPathPlan(plan)).toHaveLength(0);
  });
});
