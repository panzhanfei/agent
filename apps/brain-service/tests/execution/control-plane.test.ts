import { describe, expect, it } from "vitest";
import {
  abortTurn,
  canAttemptAgain,
  createPendingSlot,
  isDeadlineExceeded,
  legalizeRetryPolicy,
  loadRetryPolicyFromEnv,
  markSlotAttempt,
  markSlotDone,
  markSlotRunning,
  markSlotSkipped,
  registerTurn,
  runWithSlotBudget,
  shouldSkipForDeps,
  shouldTriggerGlobalRebatch,
  skippedDepsResult,
  unregisterTurn,
  DEFAULT_RETRY_POLICY,
} from "@/agentflow/execution";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";

const okResult = (id = "a"): ToolRunResult => ({
  toolId: "search_web",
  label: id,
  ok: true,
  answer: "ok",
  citations: [],
  hits: [],
  insufficientEvidence: false,
  confidence: 0.9,
});

const failResult = (id = "a"): ToolRunResult => ({
  toolId: "search_web",
  label: id,
  ok: false,
  answer: "fail",
  citations: [],
  hits: [],
  insufficientEvidence: true,
  confidence: 0.1,
});

describe("RetryPolicy", () => {
  it("legalizes to unified defaults", () => {
    expect(legalizeRetryPolicy(null)).toEqual(DEFAULT_RETRY_POLICY);
    expect(legalizeRetryPolicy({ maxAttempts: 0, deadlineMs: 10 }).maxAttempts).toBe(
      2
    );
  });

  it("enforces strict attempt budget", () => {
    let slot = createPendingSlot("km-1");
    slot = markSlotRunning(slot);
    slot = markSlotAttempt(slot);
    expect(canAttemptAgain(slot, DEFAULT_RETRY_POLICY)).toBe(true);
    slot = markSlotAttempt(slot);
    expect(slot.attempts).toBe(2);
    expect(canAttemptAgain(slot, DEFAULT_RETRY_POLICY)).toBe(false);
  });

  it("detects deadline", () => {
    const slot = {
      ...createPendingSlot("km-1"),
      startedAtMs: 0,
    };
    expect(isDeadlineExceeded(slot, { maxAttempts: 2, deadlineMs: 1000 }, 999)).toBe(
      false
    );
    expect(isDeadlineExceeded(slot, { maxAttempts: 2, deadlineMs: 1000 }, 1000)).toBe(
      true
    );
  });
});

describe("DAG deps prune", () => {
  it("skips when any dep failed", () => {
    expect(
      shouldSkipForDeps(["a", "b"], { a: okResult("a"), b: failResult("b") })
    ).toBe(true);
    expect(shouldSkipForDeps(["a"], { a: okResult("a") })).toBe(false);
  });

  it("builds structured skip result", () => {
    const r = skippedDepsResult({
      toolId: "synthesize_merge",
      label: "综合",
      missingDeps: ["tool-web"],
    });
    expect(r.skipped).toBe(true);
    expect(r.skipReason).toBe("deps");
    expect(r.ok).toBe(false);
  });
});

describe("global rebatch threshold", () => {
  it("triggers when failed slots >= half", () => {
    const a = markSlotSkipped(markSlotAttempt(createPendingSlot("a")), "error");
    const b = markSlotDone(markSlotAttempt(createPendingSlot("b")));
    expect(shouldTriggerGlobalRebatch([a, b])).toBe(true);
    expect(shouldTriggerGlobalRebatch([b, markSlotDone(createPendingSlot("c"))])).toBe(
      false
    );
  });
});

describe("runWithSlotBudget", () => {
  const okPatch = (): PlanSlotWorkerPatch => ({
    slotId: "km-1",
    executor: "km",
    sub: {
      slot: "km-1",
      label: "姓名",
      hits: [
        {
          path: "personal/resume.md",
          title: "简历",
          excerpt: "潘展飞",
          relevance: 0.9,
        },
      ],
      coverage: "sufficient",
      notes: null,
      cacheHit: false,
      facetAnswerCacheHit: false,
    },
    stepResult: {
      stepId: "km-1",
      pathKind: "km",
      label: "姓名",
      hits: [],
      coverage: "sufficient",
      notes: null,
      fc: {
        passed: true,
        refinedSearchQuery: null,
        issues: [],
        checkerNotes: null,
      },
    },
  });

  it("marks done on success", async () => {
    const { slotRuntime, patch } = await runWithSlotBudget({
      slotId: "km-1",
      executor: "km",
      label: "姓名",
      policy: { maxAttempts: 2, deadlineMs: 5_000 },
      run: async () => okPatch(),
    });
    expect(slotRuntime.status).toBe("done");
    expect(patch.slotRuntime?.status).toBe("done");
  });

  it("marks skipped timeout when work exceeds deadline", async () => {
    const { slotRuntime, patch } = await runWithSlotBudget({
      slotId: "km-slow",
      executor: "km",
      label: "慢槽",
      policy: { maxAttempts: 2, deadlineMs: 30 },
      run: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return okPatch();
      },
    });
    expect(slotRuntime.status).toBe("skipped");
    expect(slotRuntime.reason).toBe("timeout");
    expect(patch.error).toBe("slot_deadline_exceeded");
  });

  it("marks aborted when turn signal fires", async () => {
    const ac = new AbortController();
    const work = runWithSlotBudget({
      slotId: "km-abort",
      executor: "km",
      label: "取消槽",
      policy: { maxAttempts: 2, deadlineMs: 5_000 },
      signal: ac.signal,
      abortReason: "cancelled",
      run: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return okPatch();
      },
    });
    ac.abort();
    const { slotRuntime, patch } = await work;
    expect(slotRuntime.status).toBe("aborted");
    expect(slotRuntime.reason).toBe("cancelled");
    expect(patch.error).toBe("turn_cancelled");
  });

  it("loadRetryPolicyFromEnv falls back to defaults", () => {
    const prevA = process.env.SLOT_MAX_ATTEMPTS;
    const prevD = process.env.SLOT_DEADLINE_MS;
    delete process.env.SLOT_MAX_ATTEMPTS;
    delete process.env.SLOT_DEADLINE_MS;
    expect(loadRetryPolicyFromEnv()).toEqual(DEFAULT_RETRY_POLICY);
    if (prevA !== undefined) process.env.SLOT_MAX_ATTEMPTS = prevA;
    if (prevD !== undefined) process.env.SLOT_DEADLINE_MS = prevD;
  });
});

describe("turn registry", () => {
  it("abortTurn flips AbortSignal", () => {
    const turnId = crypto.randomUUID();
    const controller = registerTurn({
      turnId,
      conversationId: "c1",
      actorUserId: "u1",
    });
    expect(controller.signal.aborted).toBe(false);
    expect(abortTurn(turnId, "superseded")).toBe(true);
    expect(controller.signal.aborted).toBe(true);
    unregisterTurn(turnId);
    expect(abortTurn(turnId, "cancelled")).toBe(false);
  });
});
