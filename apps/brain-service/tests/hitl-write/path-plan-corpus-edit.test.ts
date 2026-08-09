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

  it("coerces update with empty afterContent to open", () => {
    const plan = legalizePathPlan({
      steps: [
        {
          id: "edit-empty",
          kind: "corpus_edit",
          label: "修改亲友关系",
          searchQuery: "personal/亲友关系.md",
          queryType: "default",
          topics: ["personal"],
          params: {
            targetPath: "personal/亲友关系.md",
            operation: "update",
            afterContent: "",
          },
        },
      ],
    });
    expect(stepsOfKind(plan, "corpus_edit")).toHaveLength(1);
    expect(plan.steps[0]?.params?.operation).toBe("open");
  });

  it("legalizes create empty and open preview", () => {
    const createPlan = legalizePathPlan({
      steps: [
        {
          id: "create-1",
          kind: "corpus_edit",
          label: "新建",
          searchQuery: "personal/_x.md",
          queryType: "default",
          topics: ["personal"],
          params: {
            targetPath: "personal/_x.md",
            operation: "create",
            afterContent: "",
          },
        },
      ],
    });
    expect(stepsOfKind(createPlan, "corpus_edit")).toHaveLength(1);
    expect(createPlan.steps[0]?.params?.operation).toBe("create");

    const openPlan = legalizePathPlan({
      steps: [
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
    expect(stepsOfKind(openPlan, "corpus_edit")).toHaveLength(1);
    expect(openPlan.steps[0]?.params?.operation).toBe("open");
    expect(deriveCompositeSlotsFromPathPlan(openPlan)[0]?.executor).toBe(
      "corpus_edit"
    );
  });
});
