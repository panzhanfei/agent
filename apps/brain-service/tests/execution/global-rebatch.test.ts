import { describe, expect, it } from "vitest";
import {
  applyGlobalRebatchRepairs,
  isSlotStructurallySalvageable,
  parseGlobalRebatchPlan,
  selectSalvageableDagNodeIds,
  selectSalvageableSlotIds,
} from "@/agentflow/agents/online/plan-fanout/global-rebatch";
import {
  createPendingSlot,
  markSlotAttempt,
  markSlotDone,
  markSlotSkipped,
  shouldSkipForDeps,
  unsatisfiedOptionalDeps,
  DEFAULT_RETRY_POLICY,
  isGlobalRebatchEnabledFromEnv,
} from "@/agentflow/execution";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";

const emptyPatch = (
  slotId: string,
  opts?: { error?: string; coverage?: "none" | "sufficient" }
): PlanSlotWorkerPatch => ({
  slotId,
  executor: "km",
  sub: {
    slot: slotId,
    label: slotId,
    hits: [],
    coverage: opts?.coverage ?? "none",
    notes: null,
    cacheHit: false,
    facetAnswerCacheHit: false,
  },
  stepResult: {
    stepId: slotId,
    pathKind: "km",
    label: slotId,
    hits: [],
    coverage: opts?.coverage ?? "none",
    notes: null,
    fc: {
      passed: true,
      refinedSearchQuery: null,
      issues: [],
      checkerNotes: null,
    },
  },
  error: opts?.error ?? null,
});

describe("global B selection (structural)", () => {
  it("selects coverage=none when budget remains", () => {
    let runtime = createPendingSlot("a");
    runtime = markSlotAttempt(runtime);
    runtime = markSlotDone(runtime, { degraded: true });
    expect(
      isSlotStructurallySalvageable(emptyPatch("a"), runtime, DEFAULT_RETRY_POLICY)
    ).toBe(true);
  });

  it("rejects when attempts exhausted", () => {
    let runtime = createPendingSlot("a");
    runtime = markSlotAttempt(runtime);
    runtime = markSlotAttempt(runtime);
    runtime = markSlotSkipped(runtime, "error");
    expect(
      isSlotStructurallySalvageable(emptyPatch("a"), runtime, DEFAULT_RETRY_POLICY)
    ).toBe(false);
  });

  it("selectSalvageableSlotIds filters by structure", () => {
    const a = markSlotSkipped(markSlotAttempt(createPendingSlot("a")), "error");
    const b = markSlotDone(markSlotAttempt(createPendingSlot("b")));
    const ids = selectSalvageableSlotIds({
      slotIds: ["a", "b"],
      patches: [
        emptyPatch("a", { error: "fail" }),
        {
          ...emptyPatch("b", { coverage: "sufficient" }),
          sub: {
            ...emptyPatch("b").sub,
            coverage: "sufficient",
            hits: [
              {
                path: "p.md",
                title: "t",
                excerpt: "x",
                relevance: 1,
              },
            ],
          },
        },
      ],
      slotRuntimeById: { a, b },
      policy: DEFAULT_RETRY_POLICY,
    });
    expect(ids).toEqual(["a"]);
  });

  it("skips hard-deps-skipped DAG nodes for B", () => {
    const results: Record<string, ToolRunResult> = {
      resume: {
        toolId: "retrieve_corpus",
        label: "简历",
        ok: false,
        answer: "fail",
        citations: [],
        hits: [],
        insufficientEvidence: true,
        confidence: 0.1,
      },
      synthesis: {
        toolId: "synthesize_merge",
        label: "综合",
        ok: false,
        answer: "skipped",
        citations: [],
        hits: [],
        insufficientEvidence: true,
        confidence: 0.2,
        skipped: true,
        skipReason: "deps",
      },
    };
    const ids = selectSalvageableDagNodeIds(
      [
        {
          id: "resume",
          label: "简历",
          dataSource: "corpus",
          toolId: "retrieve_corpus",
          deps: [],
        },
        {
          id: "synthesis",
          label: "综合",
          dataSource: "synthesize",
          toolId: "synthesize_merge",
          deps: ["resume"],
        },
      ],
      results
    );
    expect(ids).toEqual(["resume"]);
  });
});

describe("global B apply / parse", () => {
  it("parses and applies rewrite + use_web_search", () => {
    const { repairs } = parseGlobalRebatchPlan({
      repairs: [
        {
          targetId: "plan-0",
          kind: "slot",
          action: "rewrite_search_query",
          searchQuery: "姓名 全名",
        },
        {
          targetId: "plan-1",
          kind: "slot",
          action: "use_web_search",
          webQuery: "某公司 官网",
        },
        {
          targetId: "plan-2",
          kind: "slot",
          action: "abandon",
        },
      ],
    });
    expect(repairs).toHaveLength(3);

    const decision = {
      compositeSlots: [
        {
          id: "plan-0",
          label: "姓名",
          searchQuery: "名",
          queryType: "identity",
          topics: [],
          subTasks: [],
          executor: "km_retrieve",
        },
        {
          id: "plan-1",
          label: "公司",
          searchQuery: "公司",
          queryType: "default",
          topics: [],
          subTasks: [],
          executor: "km_retrieve",
        },
        {
          id: "plan-2",
          label: "其它",
          searchQuery: "其它",
          queryType: "default",
          topics: [],
          subTasks: [],
          executor: "km_retrieve",
        },
      ],
      pathPlan: {
        steps: [
          {
            id: "plan-0",
            kind: "km",
            label: "姓名",
            searchQuery: "名",
            queryType: "identity",
            topics: [],
          },
          {
            id: "plan-1",
            kind: "km",
            label: "公司",
            searchQuery: "公司",
            queryType: "default",
            topics: [],
          },
        ],
      },
    } as unknown as RoutedIntakeDecision;

    const applied = applyGlobalRebatchRepairs({
      decision,
      repairs,
      allowedSlotIds: new Set(["plan-0", "plan-1", "plan-2"]),
      allowedDagNodeIds: new Set(),
    });
    expect(applied.rebatchSlotIds).toEqual(["plan-0", "plan-1"]);
    expect(applied.decision.compositeSlots?.[0]?.searchQuery).toBe("姓名 全名");
    expect(applied.decision.compositeSlots?.[1]?.executor).toBe("tool_run");
    expect(applied.decision.compositeSlots?.[1]?.toolId).toBe("search_web");
    expect(applied.decision.pathPlan?.steps[1]?.kind).toBe("tool");
  });

  it("drops rewrite without query", () => {
    const { repairs } = parseGlobalRebatchPlan({
      repairs: [
        {
          targetId: "a",
          kind: "slot",
          action: "rewrite_search_query",
          searchQuery: "  ",
        },
      ],
    });
    expect(repairs).toEqual([]);
  });
});

describe("DAG soft deps", () => {
  const ok = (id: string): ToolRunResult => ({
    toolId: "search_web",
    label: id,
    ok: true,
    answer: "ok",
    citations: [],
    hits: [],
    insufficientEvidence: false,
    confidence: 0.9,
  });
  const fail = (id: string): ToolRunResult => ({
    toolId: "search_web",
    label: id,
    ok: false,
    answer: "fail",
    citations: [],
    hits: [],
    insufficientEvidence: true,
    confidence: 0.1,
  });

  it("soft optional dep failure does not skip", () => {
    expect(
      shouldSkipForDeps(
        ["resume", "company", "market"],
        { resume: ok("resume"), company: fail("company"), market: fail("market") },
        ["company", "market"]
      )
    ).toBe(false);
    expect(
      unsatisfiedOptionalDeps(
        ["resume", "company", "market"],
        { resume: ok("resume"), company: fail("company"), market: ok("market") },
        ["company", "market"]
      )
    ).toEqual(["company"]);
  });

  it("hard dep failure still skips", () => {
    expect(
      shouldSkipForDeps(
        ["resume", "company"],
        { resume: fail("resume"), company: ok("company") },
        ["company"]
      )
    ).toBe(true);
  });
});

describe("SLOT_GLOBAL_REBATCH_ENABLED default on", () => {
  it("unset enables global B", () => {
    const prev = process.env.SLOT_GLOBAL_REBATCH_ENABLED;
    delete process.env.SLOT_GLOBAL_REBATCH_ENABLED;
    expect(isGlobalRebatchEnabledFromEnv()).toBe(true);
    process.env.SLOT_GLOBAL_REBATCH_ENABLED = "0";
    expect(isGlobalRebatchEnabledFromEnv()).toBe(false);
    if (prev === undefined) delete process.env.SLOT_GLOBAL_REBATCH_ENABLED;
    else process.env.SLOT_GLOBAL_REBATCH_ENABLED = prev;
  });
});
