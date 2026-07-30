import { describe, expect, it } from "vitest";
import {
  buildDagStepResults,
  mergeCompositeWithDagSteps,
  mergeStepResultsByAnswerOrder,
} from "@/agentflow/agents/online/plan-fanout";
import {
  emptyPathPlan,
  stepsOfKind,
} from "@/agentflow/agents/online/intake-coordinator";

describe("planFanOut merge helpers", () => {
  it("merges stepResults by answerOrder with dag after slots", () => {
    const pathPlan = {
      ...emptyPathPlan(),
      steps: [
        {
          id: "km-age",
          kind: "km" as const,
          label: "年龄",
          searchQuery: "年龄",
          queryType: "identity" as const,
          topics: [],
        },
        {
          id: "dag-fit",
          kind: "dag" as const,
          label: "适合度",
          searchQuery: "适合度",
          queryType: "default" as const,
          topics: [],
          template: "hybrid_multi_source" as const,
        },
      ],
    };
    const merged = mergeStepResultsByAnswerOrder(
      ["km-age", "dag-fit"],
      pathPlan,
      [
        {
          stepId: "km-age",
          pathKind: "km",
          label: "年龄",
          hits: [],
          coverage: "sufficient",
          notes: null,
          fc: { passed: true },
        },
      ],
      buildDagStepResults(pathPlan, {
        hits: [],
        coverage: "partial",
        notes: "dag ok",
      })
    );
    expect(merged.map((s) => s.stepId)).toEqual(["km-age", "dag-fit"]);
  });

  it("inserts dag compositeSubResults in answerOrder", () => {
    const pathPlan = {
      ...emptyPathPlan(),
      steps: [
        {
          id: "dag-fit",
          kind: "dag" as const,
          label: "适合度",
          searchQuery: "适合度",
          queryType: "default" as const,
          topics: [],
          template: "hybrid_multi_source" as const,
        },
      ],
    };
    const merged = mergeCompositeWithDagSteps(
      {
        userQuestion: "test",
        compositeSubResults: [
          {
            slot: "km-age",
            facetKey: "age",
            label: "年龄",
            hits: [],
            coverage: "sufficient",
            notes: null,
            cacheHit: false,
          },
        ],
        compositeIncrementalPlan: {
          slots: [
            {
              id: "km-age",
              label: "年龄",
              searchQuery: "年龄",
              queryType: "identity",
              topics: [],
              subTasks: ["年龄"],
              facetKey: "age",
              useCachedAnswer: false,
              cachedAnswer: null,
              resolvedSub: null,
              needsKmRetrieve: true,
            },
          ],
          slotPlanById: {},
          activeRetrievalSlots: [],
          facetCacheHits: 0,
          hitsCacheHits: 0,
          sessionCleared: false,
        },
      } as never,
      pathPlan,
      ["km-age", "dag-fit"],
      stepsOfKind(pathPlan, "dag"),
      {
        hits: [],
        coverage: "partial",
        notes: "dag ok",
        toolResults: {
          synthesis: {
            toolId: "synthesize_merge",
            label: "综合",
            ok: true,
            answer: "综合评估结论",
            citations: [],
            hits: [],
            insufficientEvidence: false,
            confidence: 0.8,
          },
        },
      }
    );
    expect(merged.compositeSubResults?.map((s) => String(s.slot))).toEqual([
      "km-age",
      "dag-fit",
    ]);
    expect(merged.compositeSubResults?.[1]?.notes).toContain("综合评估结论");
  });
});
