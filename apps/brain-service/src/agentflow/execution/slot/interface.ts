/**
 * 槽状态机类型（执行控制面）。
 * 语义策略归 LLM / Intake；此处仅状态结构。
 */

/** 槽终态与中间态（失败并入 skipped，用 reason 区分） */
export type SlotStatus =
  | "pending"
  | "running"
  | "done"
  | "skipped"
  | "aborted";

/** skipped / 降级原因：结构化枚举，非口语推断 */
export type SlotStatusReason =
  | "timeout"
  | "budget"
  | "deps"
  | "error"
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

/** Join 可汇合终态。人等走图 interrupt，不占槽状态。 */
export const SLOT_TERMINAL: ReadonlySet<SlotStatus> = new Set([
  "done",
  "skipped",
  "aborted",
]);
