/**
 * 进行中 Turn 注册表：按 turnId 点名 Abort。
 * 供 HTTP cancel API 与 SSE 断流双保险。
 */
import type { TurnAbortReason } from "@fambrain/brain-types";
import type { RegisteredTurn } from "./interface";

export type { RegisteredTurn } from "./interface";

const activeTurns = new Map<string, RegisteredTurn>();

export const registerTurn = (input: {
  turnId: string;
  conversationId: string;
  actorUserId: string;
}): AbortController => {
  const existing = activeTurns.get(input.turnId);
  if (existing) {
    return existing.controller;
  }
  const controller = new AbortController();
  activeTurns.set(input.turnId, {
    turnId: input.turnId,
    conversationId: input.conversationId,
    actorUserId: input.actorUserId,
    controller,
    reason: null,
  });
  return controller;
};

export const getTurn = (turnId: string): RegisteredTurn | undefined =>
  activeTurns.get(turnId);

export const getTurnAbortReason = (
  turnId: string
): TurnAbortReason | null => activeTurns.get(turnId)?.reason ?? null;

export const abortTurn = (
  turnId: string,
  reason: TurnAbortReason = "cancelled"
): boolean => {
  const entry = activeTurns.get(turnId);
  if (!entry) return false;
  if (!entry.reason) entry.reason = reason;
  if (!entry.controller.signal.aborted) {
    entry.controller.abort();
  }
  return true;
};

export const unregisterTurn = (turnId: string): void => {
  activeTurns.delete(turnId);
};
