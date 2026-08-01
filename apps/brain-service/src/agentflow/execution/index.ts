/**
 * 执行控制面：槽状态 / 预算 / DAG 结构裁剪 / Turn 取消。
 * 语义规划归 Intake + 单槽 L1；本包只做结构兜底。
 */
export type {
  SlotRuntimeState,
  SlotStatus,
  SlotStatusReason,
} from "./slot";
export {
  SLOT_TERMINAL,
  createPendingSlot,
  isTerminalSlotStatus,
  markSlotAborted,
  markSlotAttempt,
  markSlotDone,
  markSlotRunning,
  markSlotSkipped,
  shouldTriggerGlobalRebatch,
  runWithSlotBudget,
  type BudgetedSlotResult,
} from "./slot";

export type { RetryPolicy } from "./policy";
export {
  DEFAULT_RETRY_POLICY,
  canAttemptAgain,
  isDeadlineExceeded,
  legalizeRetryPolicy,
  loadRetryPolicyFromEnv,
  isGlobalRebatchEnabledFromEnv,
} from "./policy";

export {
  isDepSatisfied,
  shouldSkipForDeps,
  skippedDepsResult,
} from "./dag";

export type { RegisteredTurn, TurnControl } from "./turn";
export {
  registerTurn,
  unregisterTurn,
  abortTurn,
  getTurn,
  getTurnAbortReason,
} from "./turn";
