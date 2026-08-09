/**
 * 聊天 actions 统一生命周期（与 HITL corpus_edit 对齐）：
 * - 交互后按 group / message 置灰
 * - pending 超过 CHAT_ACTION_PENDING_TTL_MS（30min）失效
 * - 新开会话清空前端 stale（服务端另作废 HITL pending 提案）
 */

/** 与 brain hitl-write/lifecycle CORPUS_EDIT_PENDING_TTL_MS 同一数值 */
export const CHAT_ACTION_PENDING_TTL_MS = 30 * 60 * 1000;

/** 与 brain hitl-write/actions 前缀对齐（UI 侧，非口语硬编码） */
export const CORPUS_EDIT_ACTION = {
  openDetailPrefix: "__FAMBRAIN_CORPUS_EDIT_DETAIL__:",
  approvePrefix: "__FAMBRAIN_CORPUS_EDIT_APPROVE__:",
  rejectPrefix: "__FAMBRAIN_CORPUS_EDIT_REJECT__:",
  openFilePrefix: "__FAMBRAIN_CORPUS_EDIT_OPEN__:",
  dismissEditPrefix: "__FAMBRAIN_CORPUS_EDIT_DISMISS_EDIT__:",
} as const;

const VAULT_WS = {
  listPrefix: "__FAMBRAIN_VAULT_WS_LIST__:",
  openPrefix: "__FAMBRAIN_VAULT_WS_OPEN__:",
  createFilePrefix: "__FAMBRAIN_VAULT_WS_CREATE_FILE__:",
  createFolderPrefix: "__FAMBRAIN_VAULT_WS_CREATE_FOLDER__:",
  deleteFilePrefix: "__FAMBRAIN_VAULT_WS_DELETE_FILE__:",
  deleteFolderPrefix: "__FAMBRAIN_VAULT_WS_DELETE_FOLDER__:",
} as const;

/** UI exact-match（与 brain ENUMERATION_ACTION_PROMPTS 对齐，非口语猜意图） */
const ENUM_PROMPTS = {
  更多项目: "enum:project:continue",
  列出全部项目名称: "enum:project:exhaustive",
  更多经历: "enum:experience:continue",
  列出全部工作经历公司: "enum:experience:exhaustive",
} as const;

export type ChatActionPayload = {
  id: string;
  label: string;
  prompt: string;
  displayText?: string;
  disabled?: boolean;
  clientHandler?: "chat" | "open_editor";
  /** 所属助手消息（点击后整条 message 作废，对齐 HITL 提案消费） */
  sourceMessageId?: string;
};

export const messageActionStaleKey = (messageId: string): string =>
  `message:${messageId}`;

const parentCwd = (rel: string): string => {
  const t = rel.trim();
  if (!t.includes("/")) return "";
  return t.replace(/\/[^/]+$/, "");
};

/** 从 prompt 推导 stale 分组（HITL proposal/path、vault cwd、enumeration） */
export const chatActionStaleGroupKey = (prompt: string): string | null => {
  const t = prompt.trim();
  if (!t) return null;

  if (t.startsWith(CORPUS_EDIT_ACTION.openDetailPrefix)) {
    return `proposal:${t.slice(CORPUS_EDIT_ACTION.openDetailPrefix.length).trim()}`;
  }
  if (t.startsWith(CORPUS_EDIT_ACTION.approvePrefix)) {
    return `proposal:${t.slice(CORPUS_EDIT_ACTION.approvePrefix.length).trim()}`;
  }
  if (t.startsWith(CORPUS_EDIT_ACTION.rejectPrefix)) {
    return `proposal:${t.slice(CORPUS_EDIT_ACTION.rejectPrefix.length).trim()}`;
  }
  if (t.startsWith(CORPUS_EDIT_ACTION.openFilePrefix)) {
    return `path:${t.slice(CORPUS_EDIT_ACTION.openFilePrefix.length).trim()}`;
  }
  if (t.startsWith(CORPUS_EDIT_ACTION.dismissEditPrefix)) {
    return `path:${t.slice(CORPUS_EDIT_ACTION.dismissEditPrefix.length).trim()}`;
  }

  if (t.startsWith(VAULT_WS.listPrefix)) {
    return `vault:cwd:${t.slice(VAULT_WS.listPrefix.length)}`;
  }
  if (t.startsWith(VAULT_WS.createFilePrefix)) {
    return `vault:cwd:${t.slice(VAULT_WS.createFilePrefix.length)}`;
  }
  if (t.startsWith(VAULT_WS.createFolderPrefix)) {
    return `vault:cwd:${t.slice(VAULT_WS.createFolderPrefix.length)}`;
  }
  if (t.startsWith(VAULT_WS.openPrefix)) {
    const fileRel = t.slice(VAULT_WS.openPrefix.length);
    return fileRel ? `vault:cwd:${parentCwd(fileRel)}` : null;
  }
  if (t.startsWith(VAULT_WS.deleteFilePrefix)) {
    const fileRel = t.slice(VAULT_WS.deleteFilePrefix.length);
    return fileRel ? `vault:cwd:${parentCwd(fileRel)}` : null;
  }
  if (t.startsWith(VAULT_WS.deleteFolderPrefix)) {
    const folderRel = t.slice(VAULT_WS.deleteFolderPrefix.length);
    return folderRel ? `vault:cwd:${parentCwd(folderRel)}` : null;
  }

  if (t in ENUM_PROMPTS) {
    return ENUM_PROMPTS[t as keyof typeof ENUM_PROMPTS];
  }

  return null;
};

/** @deprecated 使用 chatActionStaleGroupKey */
export const corpusEditStaleGroupKey = chatActionStaleGroupKey;

export const isChatActionExpired = (
  createdAt: string | number | Date | null | undefined
): boolean => {
  if (createdAt == null) return false;
  const ms =
    typeof createdAt === "number"
      ? createdAt
      : createdAt instanceof Date
        ? createdAt.getTime()
        : Date.parse(createdAt);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms > CHAT_ACTION_PENDING_TTL_MS;
};

export const actionIsStale = (
  prompt: string,
  staleKeys: ReadonlySet<string>,
  opts?: {
    messageId?: string | null;
    messageCreatedAt?: string | number | Date | null;
  }
): boolean => {
  if (opts?.messageId && staleKeys.has(messageActionStaleKey(opts.messageId))) {
    return true;
  }
  if (isChatActionExpired(opts?.messageCreatedAt)) return true;
  const key = chatActionStaleGroupKey(prompt);
  return key != null && staleKeys.has(key);
};

export const corpusEditTargetPathFromOpenPrompt = (
  prompt: string
): string | null => {
  const t = prompt.trim();
  if (!t.startsWith(CORPUS_EDIT_ACTION.openFilePrefix)) return null;
  const path = t.slice(CORPUS_EDIT_ACTION.openFilePrefix.length).trim();
  return path || null;
};
