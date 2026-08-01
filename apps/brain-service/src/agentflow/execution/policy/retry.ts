import type { SlotRuntimeState } from "../slot/interface";
import { DEFAULT_RETRY_POLICY, type RetryPolicy } from "./interface";

/** 合法化预算：非法/缺省 → 统一初值（结构兜底，非业务猜意图） */
export const legalizeRetryPolicy = (raw?: Partial<RetryPolicy> | null): RetryPolicy => {
  const maxAttempts = Number(raw?.maxAttempts);
  const deadlineMs = Number(raw?.deadlineMs);
  return {
    maxAttempts:
      Number.isFinite(maxAttempts) && maxAttempts >= 1
        ? Math.min(Math.floor(maxAttempts), 8)
        : DEFAULT_RETRY_POLICY.maxAttempts,
    deadlineMs:
      Number.isFinite(deadlineMs) && deadlineMs >= 1_000
        ? Math.min(Math.floor(deadlineMs), 600_000)
        : DEFAULT_RETRY_POLICY.deadlineMs,
  };
};

export const canAttemptAgain = (
  slot: Pick<SlotRuntimeState, "attempts" | "status">,
  policy: RetryPolicy
): boolean => {
  if (slot.status === "aborted" || slot.status === "awaiting_human") return false;
  return slot.attempts < policy.maxAttempts;
};

export const isDeadlineExceeded = (
  slot: Pick<SlotRuntimeState, "startedAtMs">,
  policy: RetryPolicy,
  nowMs: number = Date.now()
): boolean => {
  if (slot.startedAtMs == null) return false;
  return nowMs - slot.startedAtMs >= policy.deadlineMs;
};
