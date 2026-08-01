/**
 * 执行控制面：槽状态 / 预算 / DAG 结构裁剪。
 * 语义规划归 Intake + 单槽 L1；本包只做结构兜底。
 */
export type {
  RetryPolicy,
  SlotRuntimeState,
  SlotStatus,
  SlotStatusReason,
  TurnControl,
} from "./interface";
export {
  DEFAULT_RETRY_POLICY,
  SLOT_TERMINAL,
} from "./interface";
export {
  canAttemptAgain,
  isDeadlineExceeded,
  legalizeRetryPolicy,
} from "./retry-policy";
export {
  createPendingSlot,
  isTerminalSlotStatus,
  markSlotAborted,
  markSlotAttempt,
  markSlotDone,
  markSlotRunning,
  markSlotSkipped,
  shouldTriggerGlobalRebatch,
} from "./slot-status";
export {
  isDepSatisfied,
  shouldSkipForDeps,
  skippedDepsResult,
} from "./dag-prune";
export {
  loadRetryPolicyFromEnv,
  isGlobalRebatchEnabledFromEnv,
} from "./load-policy-from-env";
export {
  runWithSlotBudget,
  type BudgetedSlotResult,
} from "./with-slot-budget";
export {
  registerTurn,
  unregisterTurn,
  abortTurn,
  getTurn,
  getTurnAbortReason,
  type RegisteredTurn,
} from "./turn-registry";
