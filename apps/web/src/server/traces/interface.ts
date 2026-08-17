import type { ConversationTurnLog } from "@/lib/chat/conversation-logs";

export type ConversationTracesDto = {
  conversationId: string;
  turns: ConversationTurnLog[];
};
