import type { TurnAbortReason } from "@fambrain/brain-types";

export type TurnControl = {
  turnId: string;
  /** 被 supersede / cancel 时置 true；写回前必须检查 */
  aborted: boolean;
};

export type RegisteredTurn = {
  turnId: string;
  conversationId: string;
  actorUserId: string;
  controller: AbortController;
  reason: TurnAbortReason | null;
};
