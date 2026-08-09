/**
 * HITL 语料修订 UI 辅助（兼容旧 import 路径）。
 * 生命周期与 vault / enumeration 统一见 `@/lib/chat/action-lifecycle`。
 */
export {
  CHAT_ACTION_PENDING_TTL_MS,
  CORPUS_EDIT_ACTION,
  actionIsStale,
  chatActionStaleGroupKey,
  corpusEditStaleGroupKey,
  corpusEditTargetPathFromOpenPrompt,
  isChatActionExpired,
  messageActionStaleKey,
  type ChatActionPayload,
} from "@/lib/chat/action-lifecycle";
