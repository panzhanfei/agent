import { describe, expect, it } from "vitest";
import { legalizeEmptyPolicy, legalizePathPlan } from "@/agentflow/agents/online/intake-coordinator/path-plan";
import {
  applyEmptyPolicies,
  isStepEvidenceEmpty,
  shouldSalvageForEmptyPolicy,
} from "@/agentflow/agents/online/plan-fanout/empty-policy";
import { selectSalvageableDagNodeIds } from "@/agentflow/agents/online/plan-fanout/global-rebatch";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import type { ExecutionPlanNode } from "@/agentflow/agents/online/tool-orchestrator/interface";

const emptyStep = (id: string, label = id): StepResult => ({
  stepId: id,
  pathKind: "km",
  label,
  hits: [],
  coverage: "none",
  notes: null,
});

const okStep = (id: string): StepResult => ({
  stepId: id,
  pathKind: "km",
  label: id,
  hits: [{ path: "a.md", title: "a", excerpt: "x", relevance: 0.9 }],
  coverage: "sufficient",
  notes: null,
});

describe("legalizeEmptyPolicy", () => {
  it("accepts require/omit/degrade and defaults", () => {
    expect(legalizeEmptyPolicy("require")).toBe("require");
    expect(legalizeEmptyPolicy("OMIT")).toBe("omit");
    expect(legalizeEmptyPolicy("weird")).toBe("degrade");
  });
});

describe("legalizePathPlan emptyPolicy", () => {
  it("keeps emptyPolicy on steps", () => {
    const plan = legalizePathPlan({
      steps: [
        {
          id: "km-1",
          kind: "km",
          label: "姓名",
          searchQuery: "姓名",
          queryType: "identity",
          topics: ["personal"],
          emptyPolicy: "require",
        },
        {
          id: "km-2",
          kind: "km",
          label: "爱好",
          searchQuery: "爱好",
          queryType: "default",
          topics: [],
          emptyPolicy: "omit",
        },
      ],
    });
    expect(plan.steps.find((s) => s.id === "km-1")?.emptyPolicy).toBe("require");
    expect(plan.steps.find((s) => s.id === "km-2")?.emptyPolicy).toBe("omit");
  });
});

describe("applyEmptyPolicies", () => {
  it("require empty → requireError", () => {
    const out = applyEmptyPolicies({
      pathPlan: {
        steps: [
          {
            id: "km-1",
            kind: "km",
            label: "姓名",
            searchQuery: "姓名",
            queryType: "identity",
            topics: [],
            emptyPolicy: "require",
          },
        ],
      },
      slots: [],
      stepResults: [emptyStep("km-1", "姓名")],
      compositeSubResults: null,
    });
    expect(out.requireError).toMatch(/必答/);
  });

  it("omit empty → drop from stepResults", () => {
    const out = applyEmptyPolicies({
      pathPlan: {
        steps: [
          {
            id: "a",
            kind: "km",
            label: "a",
            searchQuery: "a",
            queryType: "default",
            topics: [],
            emptyPolicy: "require",
          },
          {
            id: "b",
            kind: "km",
            label: "b",
            searchQuery: "b",
            queryType: "default",
            topics: [],
            emptyPolicy: "omit",
          },
        ],
      },
      slots: [],
      stepResults: [okStep("a"), emptyStep("b")],
      compositeSubResults: [
        {
          slot: "a",
          label: "a",
          hits: okStep("a").hits,
          coverage: "sufficient",
          notes: null,
          cacheHit: false,
          facetAnswerCacheHit: false,
        },
        {
          slot: "b",
          label: "b",
          hits: [],
          coverage: "none",
          notes: null,
          cacheHit: false,
          facetAnswerCacheHit: false,
        },
      ],
    });
    expect(out.requireError).toBeNull();
    expect(out.stepResults.map((s) => s.stepId)).toEqual(["a"]);
    expect(out.omittedStepIds).toEqual(["b"]);
    expect(out.compositeSubResults?.map((s) => s.slot)).toEqual(["a"]);
  });
});

describe("omit not salvageable", () => {
  it("skips omit dag nodes", () => {
    const plan: ExecutionPlanNode[] = [
      {
        id: "company",
        label: "公司",
        dataSource: "web",
        toolId: "search_web",
        deps: [],
        emptyPolicy: "omit",
      },
      {
        id: "resume",
        label: "简历",
        dataSource: "corpus",
        toolId: "retrieve_corpus",
        deps: [],
        emptyPolicy: "require",
      },
    ];
    const ids = selectSalvageableDagNodeIds(plan, {
      company: {
        toolId: "search_web",
        label: "公司",
        ok: false,
        answer: "",
        citations: [],
        hits: [],
        insufficientEvidence: true,
        confidence: 0,
      },
      resume: {
        toolId: "retrieve_corpus",
        label: "简历",
        ok: false,
        answer: "",
        citations: [],
        hits: [],
        insufficientEvidence: true,
        confidence: 0,
      },
    });
    expect(ids).toEqual(["resume"]);
    expect(shouldSalvageForEmptyPolicy("omit")).toBe(false);
    expect(isStepEvidenceEmpty(emptyStep("x"))).toBe(true);
  });
});
