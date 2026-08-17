import { listTurnTracesForConversation } from "@fambrain/db";
import { requireOwnedConversation } from "@/server/conversations";
import type { ConversationTracesDto } from "./interface";

export type { ConversationTracesDto } from "./interface";

export const listOwnedConversationTraces = async (input: {
  conversationId: string;
  userId: string;
}): Promise<ConversationTracesDto | null> => {
  const owned = await requireOwnedConversation(
    input.conversationId,
    input.userId
  );
  if (!owned) return null;
  const rows = await listTurnTracesForConversation({
    conversationId: input.conversationId,
    userId: input.userId,
  });
  return {
    conversationId: input.conversationId,
    turns: rows.map((r) => ({
      turnId: r.messageId,
      userQuestion: r.userQuestion ?? "",
      startedAt: r.createdAt.getTime(),
      status:
        r.status === "error"
          ? "error"
          : r.status === "cancelled"
            ? "cancelled"
            : r.status === "superseded"
              ? "superseded"
              : "done",
      entries: r.entries,
      steps: r.steps,
      ...(r.timing ? { timing: r.timing } : {}),
      ...(r.error ? { error: r.error } : {}),
    })),
  };
};
