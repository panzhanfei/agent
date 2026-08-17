import type { AssistantMessageBlock, Citation } from "@fambrain/brain-types";
import type { ConversationListItem } from "@fambrain/db";

export type { ConversationListItem };

export type ConversationSummary = {
  id: string;
  title: string;
};

export type CreatedConversation = {
  id: string;
  title: string;
  updatedAt: string;
};

export type PatchedConversation = {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: string;
};

export type UiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  retrievalPaths?: string[];
  blocks?: AssistantMessageBlock[];
  citations?: Citation[];
  taskPaused?: boolean;
  pauseKind?: "vault_wait";
};
