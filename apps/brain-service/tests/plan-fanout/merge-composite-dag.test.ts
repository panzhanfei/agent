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
          nodes: [
            {
              id: "n1",
              label: "综合",
              toolId: "synthesize_merge" as const,
              deps: [],
            },
          ],
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
          nodes: [
            {
              id: "n1",
              label: "综合",
              toolId: "synthesize_merge" as const,
              deps: [],
            },
          ],
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
            answer: "## 匹配点\n\n- x\n\n## 缺口\n\n- y\n\n## 风险/不确定\n\n- z\n\n## 结论\n\n谨慎",
            citations: [],
            hits: [],
            blocks: [
              {
                type: "text",
                markdown:
                  "## 匹配点\n\n- x\n\n## 缺口\n\n- y\n\n## 风险/不确定\n\n- z\n\n## 结论\n\n谨慎",
              },
            ],
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
    expect(merged.compositeSubResults?.[1]?.notes).toContain("## 匹配点");
    expect(merged.compositeSubResults?.[1]?.assistantBlocks?.length).toBe(1);
  });

  it("picks synthesize_merge by toolId when node id is not synthesis", () => {
    const pathPlan = {
      ...emptyPathPlan(),
      steps: [
        {
          id: "dag-bilingual",
          kind: "dag" as const,
          label: "中英对照",
          searchQuery: "城管技术",
          queryType: "tech" as const,
          topics: [],
          nodes: [
            {
              id: "synth",
              label: "对照",
              toolId: "synthesize_merge" as const,
              deps: [],
            },
          ],
        },
      ],
    };
    const merged = mergeCompositeWithDagSteps(
      {
        userQuestion: "对照",
        compositeSubResults: [],
        compositeIncrementalPlan: {
          slots: [],
          slotPlanById: {},
          activeRetrievalSlots: [],
          facetCacheHits: 0,
          hitsCacheHits: 0,
          sessionCleared: false,
        },
      } as never,
      pathPlan,
      ["dag-bilingual"],
      stepsOfKind(pathPlan, "dag"),
      {
        hits: [],
        coverage: "partial",
        notes: "dag ok",
        toolResults: {
          synth: {
            toolId: "synthesize_merge",
            label: "对照",
            ok: true,
            answer: "中：React。\nEN: React.",
            citations: [],
            hits: [],
            insufficientEvidence: false,
            confidence: 0.75,
          },
        },
      }
    );
    expect(merged.compositeSubResults?.[0]?.notes).toMatch(/React/);
  });
});
