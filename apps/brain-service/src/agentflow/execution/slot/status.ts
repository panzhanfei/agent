import {
  SLOT_TERMINAL,
  type SlotRuntimeState,
  type SlotStatus,
  type SlotStatusReason,
} from "./interface";

export const isTerminalSlotStatus = (status: SlotStatus): boolean =>
  SLOT_TERMINAL.has(status);

export const createPendingSlot = (slotId: string): SlotRuntimeState => ({
  slotId,
  status: "pending",
  reason: null,
  attempts: 0,
  degraded: false,
  startedAtMs: null,
  finishedAtMs: null,
});

export const markSlotRunning = (
  slot: SlotRuntimeState,
  nowMs: number = Date.now()
): SlotRuntimeState => ({
  ...slot,
  status: "running",
  reason: null,
  startedAtMs: slot.startedAtMs ?? nowMs,
  finishedAtMs: null,
});

export const markSlotAttempt = (slot: SlotRuntimeState): SlotRuntimeState => ({
  ...slot,
  attempts: slot.attempts + 1,
});

export const markSlotDone = (
  slot: SlotRuntimeState,
  input?: { degraded?: boolean; nowMs?: number }
): SlotRuntimeState => ({
  ...slot,
  status: "done",
  reason: input?.degraded ? "degraded" : null,
  degraded: Boolean(input?.degraded),
  finishedAtMs: input?.nowMs ?? Date.now(),
});

export const markSlotSkipped = (
  slot: SlotRuntimeState,
  reason: SlotStatusReason,
  nowMs: number = Date.now()
): SlotRuntimeState => ({
  ...slot,
  status: "skipped",
  reason,
  finishedAtMs: nowMs,
});

export const markSlotAborted = (
  slot: SlotRuntimeState,
  reason: Extract<SlotStatusReason, "cancelled" | "superseded"> = "cancelled",
  nowMs: number = Date.now()
): SlotRuntimeState => ({
  ...slot,
  status: "aborted",
  reason,
  finishedAtMs: nowMs,
});
