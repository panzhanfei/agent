/**
 * 单槽墙钟预算：Promise.race(工作, deadline)。
 * 不猜问句；只信 policy + patch 结构信号。
 */
import type {
  PlanSlotWorkerKind,
  PlanSlotWorkerPatch,
} from "@/agentflow/agents/online/plan-fanout/interface";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import type { TurnAbortReason } from "@fambrain/brain-types";
import type { RetryPolicy } from "../policy/interface";
import type { SlotRuntimeState } from "./interface";
import {
  createPendingSlot,
  markSlotAborted,
  markSlotAttempt,
  markSlotDone,
  markSlotRunning,
  markSlotSkipped,
} from "./status";

const timeoutSub = (
  slotId: string,
  label: string,
  deadlineMs: number
): CompositeSubRetrieval => ({
  slot: slotId,
  label,
  hits: [],
  coverage: "none",
  notes: `单槽超时（${deadlineMs}ms），已跳过。`,
  cacheHit: false,
  facetAnswerCacheHit: false,
});

const timeoutStep = (
  slotId: string,
  label: string,
  pathKind: StepResult["pathKind"],
  deadlineMs: number
): StepResult => ({
  stepId: slotId,
  pathKind,
  label,
  hits: [],
  coverage: "none",
  notes: `单槽超时（${deadlineMs}ms）`,
  confidenceTier: null,
  enumerationMeta: null,
  cacheHit: false,
  fc: {
    passed: true,
    refinedSearchQuery: null,
    issues: [],
    checkerNotes: "slot_deadline_exceeded",
  },
});

const pathKindForExecutor = (
  executor: PlanSlotWorkerKind
): StepResult["pathKind"] => {
  switch (executor) {
    case "list":
      return "list";
    case "mem":
      return "mem";
    case "tool":
      return "tool";
    case "summarize":
      return "summarize";
    default:
      return "km";
  }
};

const isWeakResult = (patch: PlanSlotWorkerPatch): boolean => {
  if (patch.error) return false;
  if (patch.sub.hits.length > 0) return false;
  if (patch.sub.recalledFact?.value) return false;
  if (patch.toolResult?.ok) return false;
  return patch.sub.coverage === "none" || patch.sub.hits.length === 0;
};

export type BudgetedSlotResult = {
  patch: PlanSlotWorkerPatch;
  slotRuntime: SlotRuntimeState;
};

export const runWithSlotBudget = async (input: {
  slotId: string;
  executor: PlanSlotWorkerKind;
  label: string;
  policy: RetryPolicy;
  priorRuntime?: SlotRuntimeState | null;
  /** Turn cancel / supersede；与 deadline 一并 race */
  signal?: AbortSignal | null;
  abortReason?: TurnAbortReason | null;
  run: () => Promise<PlanSlotWorkerPatch>;
}): Promise<BudgetedSlotResult> => {
  const now = Date.now();
  let runtime = input.priorRuntime ?? createPendingSlot(input.slotId);
  runtime = markSlotRunning(runtime, now);
  runtime = markSlotAttempt(runtime);

  if (input.signal?.aborted) {
    const reason = input.abortReason ?? "cancelled";
    runtime = markSlotAborted(runtime, reason);
    const patch: PlanSlotWorkerPatch = {
      slotId: input.slotId,
      executor: input.executor,
      sub: timeoutSub(input.slotId, input.label, 0),
      stepResult: timeoutStep(
        input.slotId,
        input.label,
        pathKindForExecutor(input.executor),
        0
      ),
      error: `turn_${reason}`,
      slotRuntime: runtime,
    };
    return { patch, slotRuntime: runtime };
  }

  const timeoutMs = Math.max(1, input.policy.deadlineMs);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;

  const timeoutPromise = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  const abortPromise = new Promise<"aborted">((resolve) => {
    if (!input.signal) return;
    if (input.signal.aborted) {
      resolve("aborted");
      return;
    }
    onAbort = () => resolve("aborted");
    input.signal.addEventListener("abort", onAbort, { once: true });
  });

  const workPromise = input.run().then((patch) => ({
    kind: "ok" as const,
    patch,
  }));

  try {
    const raced = await Promise.race([
      workPromise,
      timeoutPromise.then((kind) => ({ kind })),
      abortPromise.then((kind) => ({ kind })),
    ]);

    if (raced.kind === "aborted") {
      void workPromise.catch(() => undefined);
      const reason = input.abortReason ?? "cancelled";
      runtime = markSlotAborted(runtime, reason);
      const patch: PlanSlotWorkerPatch = {
        slotId: input.slotId,
        executor: input.executor,
        sub: timeoutSub(input.slotId, input.label, 0),
        stepResult: timeoutStep(
          input.slotId,
          input.label,
          pathKindForExecutor(input.executor),
          0
        ),
        error: `turn_${reason}`,
        slotRuntime: runtime,
      };
      return { patch, slotRuntime: runtime };
    }

    if (raced.kind === "timeout") {
      // 超时：语义 skip；底层 IO 可能仍跑，阶段 2 靠 turn Abort 补刀
      void workPromise.catch(() => undefined);
      runtime = markSlotSkipped(runtime, "timeout");
      const patch: PlanSlotWorkerPatch = {
        slotId: input.slotId,
        executor: input.executor,
        sub: timeoutSub(input.slotId, input.label, timeoutMs),
        stepResult: timeoutStep(
          input.slotId,
          input.label,
          pathKindForExecutor(input.executor),
          timeoutMs
        ),
        error: "slot_deadline_exceeded",
        slotRuntime: runtime,
      };
      return { patch, slotRuntime: runtime };
    }

    const patch = raced.patch;
    if (patch.error) {
      runtime = markSlotSkipped(runtime, "error");
    } else if (isWeakResult(patch)) {
      runtime = markSlotDone(runtime, { degraded: true });
    } else {
      runtime = markSlotDone(runtime);
    }

    return {
      patch: { ...patch, slotRuntime: runtime },
      slotRuntime: runtime,
    };
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort && input.signal) {
      input.signal.removeEventListener("abort", onAbort);
    }
  }
};
