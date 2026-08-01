/**
 * 执行控制面类型（阶段 0/1）。
 * 语义策略归 LLM / Intake 结构化字段；此处仅状态与预算结构。
 */

/** 槽终态与中间态（失败并入 skipped，用 reason 区分） */
export type SlotStatus =
  | "pending"
  | "running"
  | "done"
  | "skipped"
  | "aborted"
  | "awaiting_human";

/** skipped / 降级原因：结构化枚举，非口语推断 */
export type SlotStatusReason =
  | "timeout"
  | "budget"
  | "deps"
  | "error"
  | "user_reject"
  | "degraded"
  | "cancelled"
  | "superseded";

export type SlotRuntimeState = {
  slotId: string;
  status: SlotStatus;
  reason?: SlotStatusReason | null;
  /** 已消耗 attempt（含首次）；严格 ≤ budget.maxAttempts */
  attempts: number;
  degraded?: boolean;
  startedAtMs?: number | null;
  finishedAtMs?: number | null;
};

/** 次数 + 时间；初值统一，按 executor 分档留待后续 */
export type RetryPolicy = {
  maxAttempts: number;
  deadlineMs: number;
};

export type TurnControl = {
  turnId: string;
  /** 被 supersede / cancel 时置 true；写回前必须检查 */
  aborted: boolean;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 2,
  deadlineMs: 60_000,
};

export const SLOT_TERMINAL: ReadonlySet<SlotStatus> = new Set([
  "done",
  "skipped",
  "aborted",
]);
