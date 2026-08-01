import { describe, expect, it } from "vitest";
import {
  canAttemptAgain,
  createPendingSlot,
  isDeadlineExceeded,
  legalizeRetryPolicy,
  markSlotAttempt,
  markSlotDone,
  markSlotRunning,
  markSlotSkipped,
  shouldSkipForDeps,
  shouldTriggerGlobalRebatch,
  skippedDepsResult,
  DEFAULT_RETRY_POLICY,
} from "@/agentflow/execution";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";

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
