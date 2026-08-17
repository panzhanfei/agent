import type { AssistantMessageBlock, DbChatTurn } from "@fambrain/brain-types";
import {
  createConversation as createConversationRow,
  deleteOwnedConversation,
  findOwnedConversation,
  getSidebarConversations,
  listConversationMessages,
  patchOwnedConversation as patchOwnedConversationRow,
  toModelHistory,
  type ConversationListItem,
} from "@fambrain/db";
import type {
  CreatedConversation,
  ConversationSummary,
  PatchedConversation,
  UiChatMessage,
} from "./interface";

export type {
  ConversationListItem,
  ConversationSummary,
  CreatedConversation,
  PatchedConversation,
  UiChatMessage,
} from "./interface";

export const listSidebarConversations = (
  userId: string
): Promise<ConversationListItem[]> => getSidebarConversations(userId);

export const requireOwnedConversation = async (
  conversationId: string,
  userId: string
): Promise<ConversationSummary | null> => {
  const owned = await findOwnedConversation(conversationId, userId);
  if (!owned) return null;
  return { id: owned.id, title: owned.title };
};

export const createOwnedConversation = async (input: {
  userId: string;
  title?: string;
}): Promise<CreatedConversation> => {
  const created = await createConversationRow(input);
  return {
    id: created.id,
    title: created.title,
    updatedAt: created.updatedAt.toISOString(),
  };
};

export const patchOwnedConversation = async (input: {
  conversationId: string;
  userId: string;
  title?: string;
  pinned?: boolean;
}): Promise<PatchedConversation | null> => {
  const updated = await patchOwnedConversationRow(input);
  if (!updated) return null;
  return {
    id: updated.id,
    title: updated.title,
    pinned: updated.pinned,
    updatedAt: updated.updatedAt.toISOString(),
  };
};

export const deleteOwnedConversationForUser = (
  conversationId: string,
  userId: string
): Promise<boolean> => deleteOwnedConversation(conversationId, userId);

export const listUiMessages = async (
  conversationId: string
): Promise<UiChatMessage[]> => {
  const rows = await listConversationMessages(conversationId);
  return rows.map((m) => {
    const meta =
      m.metadata && typeof m.metadata === "object"
        ? (m.metadata as {
            retrievalPaths?: string[];
            blocks?: AssistantMessageBlock[];
            citations?: Array<{ path: string; excerpt: string }>;
            taskPaused?: boolean;
            pauseKind?: "vault_wait";
          })
        : undefined;
    return {
      id: m.id,
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      retrievalPaths: meta?.retrievalPaths,
      blocks: meta?.blocks,
      citations: meta?.citations,
      taskPaused: meta?.taskPaused,
      pauseKind: meta?.pauseKind,
    };
  });
};

export const listModelHistory = async (
  conversationId: string
): Promise<DbChatTurn[]> => {
  const rows = await listConversationMessages(conversationId);
  return toModelHistory(rows);
};

export { editUserMessageAndTruncateAfter } from "@fambrain/db";
