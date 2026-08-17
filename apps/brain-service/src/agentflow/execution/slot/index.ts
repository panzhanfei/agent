export type {
  SlotRuntimeState,
  SlotStatus,
  SlotStatusReason,
} from "./interface";
export { SLOT_TERMINAL } from "./interface";

export {
  createPendingSlot,
  isTerminalSlotStatus,
  markSlotAborted,
  markSlotAttempt,
  markSlotDone,
  markSlotRunning,
  markSlotSkipped,
} from "./status";

export {
  runWithSlotBudget,
  type BudgetedSlotResult,
} from "./with-budget";
