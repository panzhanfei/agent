import type { Citation } from "@fambrain/brain-types";
import type {
  ConversationLogBundle,
  ConversationTurnLog,
} from "@/lib/chat/conversation-logs";
import type { ConversationListItem, PatchConversationOk } from "./interface";

export const parseMessageCitations = (raw: unknown): Citation[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const out: Citation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const path = (item as { path?: unknown }).path;
    const excerpt = (item as { excerpt?: unknown }).excerpt;
    if (typeof path === "string" && typeof excerpt === "string") {
      out.push({ path, excerpt });
    }
  }
  return out.length ? out : undefined;
};

export const formatDuration = (ms: number): string => {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
};

/** 顶栏/侧栏展示：取首句并截断（纯 UI，不依赖 db） */
export const shortConversationTitle = (title: string, maxLen = 18): string => {
  const trimmed = title.trim() || "新对话";
  if (trimmed === "新对话") return trimmed;
  const first = trimmed.split(/[？?\n;；，,、]/)[0]?.trim() || trimmed;
  if (first.length <= maxLen) return first;
  return `${first.slice(0, maxLen)}…`;
};

export const patchTurnLog = (
  bundle: ConversationLogBundle,
  turnId: string,
  patch: (turn: ConversationTurnLog) => ConversationTurnLog
): ConversationLogBundle => ({
  ...bundle,
  turns: bundle.turns.map((turn) =>
    turn.turnId === turnId ? patch(turn) : turn
  ),
});

export const appendTurnToBundle = (
  bundle: ConversationLogBundle,
  turn: ConversationTurnLog
): ConversationLogBundle => ({
  ...bundle,
  turns: [...bundle.turns, turn],
});

export const isPatchConversationPayload = (
  v: unknown
): v is PatchConversationOk => {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.pinned === "boolean" &&
    typeof o.updatedAt === "string"
  );
};

export const sortConversationsForSidebar = (
  items: ConversationListItem[]
): ConversationListItem[] => {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
};

export const SUGGESTIONS = [
  "AI Agent 的核心工作原理是什么？",
  "用通俗语言解释大模型微调",
  "帮我写一份工作周报提纲",
  "推荐几本系统设计的入门资料",
];

export const USER_PAUSED_SUFFIX = "\n\n——用户已暂停";
