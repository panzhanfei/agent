"use client";
import type { ConversationListItem } from "@fambrain/db";
import type {
  PipelineLogEntry,
  PipelineStepName,
  PipelineTiming,
  AssistantMessageBlock,
  Citation,
} from "@fambrain/brain-types";
import { AssistantMessageContent } from "@/components/chat/assistant-message-content";
import { LinkifiedText } from "@/components/chat/linkified-text";
import { ConversationLogPanel } from "@/components/chat/conversation-log-panel";
import {
  chatActionStaleGroupKey,
  messageActionStaleKey,
  type ChatActionPayload,
} from "@/lib/chat/action-lifecycle";
import {
  createTurnLog,
  formatStepTokenLabel,
  formatTokenByNodeEntries,
  formatTokenTotalShort,
  upsertStep,
  type ConversationLogBundle,
  type ConversationTurnLog,
} from "@/lib/chat/conversation-logs";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useSpeechInput } from "@/components/chat/use-speech-input";
import { MessageCitations } from "@/components/chat/message-citations";
import { MessageRetrievalFeedback } from "@/components/chat/message-retrieval-feedback";
import {
  extractDocuments,
  filesFromInput,
} from "@/lib/documents/extract-documents";

type MessageTiming = PipelineTiming & {
  clientTotalMs?: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** ISO；用于 actions 30min TTL（与 HITL pending 对齐） */
  createdAt?: string;
  timing?: MessageTiming;
  retrievalPaths?: string[];
  blocks?: AssistantMessageBlock[];
  citations?: Citation[];
};

const parseMessageCitations = (raw: unknown): Citation[] | undefined => {
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

const STEP_TIMING_LABELS: Record<PipelineStepName, string> = {
  prepare_turn_start: "准备上下文",
  repeat_question_guard: "同问短路",
  prepare_pipeline_memory: "加载记忆",
  repeat_respond_early: "复用历史答",
  intake: "理解问题",
  user_fact: "读取记忆",
  retrieval: "检索知识库",
  km_retrieve: "知识检索",
  list_retrieve: "列举检索",
  vault_workspace: "原文库",
  plan_cache_resolve: "解析缓存",
  plan_slot_join: "槽位汇合",
  plan_slot_post: "检索后工具",
  plan_dag: "多源汇合",
  plan_merge: "合并结果",
  global_rebatch: "全局重批",
  plan_executor: "执行计划",
  fact_checker: "核查证据",
  content_summarizer: "生成摘要",
  content_organizer: "整理证据",
  analyst: "生成回答",
  persist_turn_end: "写入记忆",
};

/** 流式 step=running 时展示在「思考过程」里的短文案 */
const STEP_RUNNING_LABELS: Partial<Record<string, string>> = {
  prepare_turn_start: "准备上下文…",
  repeat_question_guard: "同问短路…",
  prepare_pipeline_memory: "加载记忆…",
  repeat_respond_early: "复用历史答…",
  intake: "理解问题…",
  user_fact: "读取记忆…",
  retrieval: "检索知识库…",
  km_retrieve: "知识检索…",
  list_retrieve: "列举检索…",
  vault_workspace: "原文库…",
  plan_cache_resolve: "解析缓存…",
  plan_slot_join: "槽位汇合…",
  plan_slot_post: "检索后工具…",
  plan_dag: "多源汇合…",
  plan_merge: "合并结果…",
  global_rebatch: "全局重批…",
  plan_executor: "执行计划…",
  fact_checker: "核查证据…",
  content_summarizer: "生成摘要…",
  content_organizer: "整理证据…",
  analyst: "生成回答…",
  persist_turn_end: "写入记忆…",
};

const formatDuration = (ms: number): string => {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
};

/** 顶栏/侧栏展示：取首句并截断（纯 UI，不依赖 db） */
const shortConversationTitle = (title: string, maxLen = 18): string => {
  const trimmed = title.trim() || "新对话";
  if (trimmed === "新对话") return trimmed;
  const first = trimmed.split(/[？?\n;；，,、]/)[0]?.trim() || trimmed;
  if (first.length <= maxLen) return first;
  return `${first.slice(0, maxLen)}…`;
};

const MessageTimingLine = ({ timing }: { timing: MessageTiming }) => {
  const [expanded, setExpanded] = useState(false);
  const nodeEntries = (
    Object.entries(timing.nodes ?? {}) as [PipelineStepName, number][]
  ).filter(([, ms]) => ms > 0);
  const tokenNodes = formatTokenByNodeEntries(timing);
  const tokenLine = formatTokenTotalShort(timing);
  const tokens = timing.tokens;
  /** 耗时步 + 仅有 token、未进 nodes 的 LLM 步 */
  const stepNames = (() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const [name] of nodeEntries) {
      seen.add(name);
      names.push(name);
    }
    for (const e of tokenNodes) {
      if (!seen.has(e.name)) names.push(e.name);
    }
    return names;
  })();
  const canExpand = stepNames.length > 0;

  return (
    <div className="mt-1.5 text-[11px] leading-snug text-[#9ca3af]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-left hover:text-[#6b7280]"
      >
        用时 {formatDuration(timing.totalMs)}
        {timing.ttftMs != null
          ? ` · 首字 ${formatDuration(timing.ttftMs)}`
          : ""}
        {tokenLine ? ` · ${tokenLine}` : ""}
        {timing.clientTotalMs != null
          ? ` · 全链路 ${formatDuration(timing.clientTotalMs)}`
          : ""}
        {canExpand ? (expanded ? " ▴" : " ▾") : ""}
      </button>
      {expanded && canExpand ? (
        <ul className="mt-1 space-y-0.5 pl-2">
          {stepNames.map((name) => {
            const ms = timing.nodes?.[name as PipelineStepName];
            const tokLabel = formatStepTokenLabel(
              timing.tokens?.byNode?.[name as PipelineStepName]
            );
            return (
              <li key={name}>
                {STEP_TIMING_LABELS[name as PipelineStepName] ?? name}
                {ms != null && ms > 0 ? ` ${formatDuration(ms)}` : ""}
                {tokLabel ? ` · ${tokLabel}` : ""}
              </li>
            );
          })}
          {tokens && tokens.totalTokens > 0 ? (
            <li className="pt-0.5 font-medium text-[#6b7280]">
              合计 {tokens.totalTokens.toLocaleString()} tok（入{" "}
              {tokens.promptTokens.toLocaleString()} / 出{" "}
              {tokens.completionTokens.toLocaleString()}）
              {tokens.estimated ? "（估算）" : ""}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
};

const patchTurnLog = (
  bundle: ConversationLogBundle,
  turnId: string,
  patch: (turn: ConversationTurnLog) => ConversationTurnLog
): ConversationLogBundle => ({
  ...bundle,
  turns: bundle.turns.map((turn) =>
    turn.turnId === turnId ? patch(turn) : turn
  ),
});

const appendTurnToBundle = (
  bundle: ConversationLogBundle,
  turn: ConversationTurnLog
): ConversationLogBundle => ({
  ...bundle,
  turns: [...bundle.turns, turn],
});

type PatchConversationOk = {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: string;
};
const isPatchConversationPayload = (v: unknown): v is PatchConversationOk => {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.pinned === "boolean" &&
    typeof o.updatedAt === "string"
  );
};
const sortConversationsForSidebar = (
  items: ConversationListItem[]
): ConversationListItem[] => {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
};
const AssistantPendingRow = () => {
  return (
    <li className="flex justify-start" aria-live="polite">
      <div className="flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-[14px] text-[#6b7280] shadow-sm">
        <span
          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#e5e7eb] border-t-[#4f46e5]"
          aria-hidden
        />
        <span>正在生成回复</span>
        <span className="inline-flex items-center gap-0.5" aria-hidden>
          {[0, 120, 240].map((delayMs) => (
            <span
              key={delayMs}
              className="inline-block h-1 w-1 animate-pulse rounded-full bg-[#9ca3af]"
              style={{ animationDelay: `${delayMs}ms` }}
            />
          ))}
        </span>
      </div>
    </li>
  );
};
const SUGGESTIONS = [
  "AI Agent 的核心工作原理是什么？",
  "用通俗语言解释大模型微调",
  "帮我写一份工作周报提纲",
  "推荐几本系统设计的入门资料",
];
const IconChat = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  );
};
const IconSidebarToggle = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="3" y="4" width="18" height="6" rx="1" />
      <rect x="3" y="14" width="12" height="6" rx="1" />
    </svg>
  );
};
const IconPlus = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
};
const IconMic = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
        strokeLinejoin="round"
      />
      <path d="M19 11a7 7 0 0 1-14 0" strokeLinecap="round" />
      <path d="M12 19v3" strokeLinecap="round" />
    </svg>
  );
};
const IconPin = ({
  active,
  className,
}: {
  active?: boolean;
  className?: string;
}) => {
  return (
    <svg
      className={className}
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2.7 14.02 9.06l7.06.61-5.41 4.62 1.71 6.93L12 18.56l-6.39 4.67 1.71-6.93-5.41-4.61 7.06-.61L12 2.7z" />
    </svg>
  );
};
const IconEditTitle = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m15.2 6.9 3.9-4L21 3l-.9 2-3.9 4M13 10l8-9-5-5-8 9v5h5Z"
      />
    </svg>
  );
};
const IconTrash = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path strokeLinecap="round" d="M4 7h16" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9L18 7"
      />
    </svg>
  );
};
const fetchJson = async <T,>(
  url: string
): Promise<
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    }
> => {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      let msg = `${res.status}`;
      try {
        const body = await res.json();
        if (body?.error && typeof body.error === "string") msg = body.error;
      } catch {
        //
      }
      return { ok: false, error: msg };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "网络错误" };
  }
};
const USER_PAUSED_SUFFIX = "\n\n——用户已暂停";

const consumeSse = async (
  stream: ReadableStream<Uint8Array>,
  handle: (event: string, payload: unknown) => void,
  signal?: AbortSignal
): Promise<void> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  if (signal) {
    if (signal.aborted) {
      await reader.cancel().catch(() => undefined);
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const idx = buffer.indexOf("\n\n");
        if (idx < 0) break;
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let eventName = "message";
        let dataPayload = "";
        const lines = raw.split("\n").filter(Boolean);
        for (const ln of lines) {
          if (ln.startsWith("event:"))
            eventName = ln.slice("event:".length).trim();
          else if (ln.startsWith("data:"))
            dataPayload = ln.slice("data:".length).trim();
        }
        if (dataPayload) {
          let parsed: unknown = dataPayload;
          try {
            parsed = JSON.parse(dataPayload);
          } catch {
            //
          }
          handle(eventName, parsed);
        }
      }
    }
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {
      //
    }
  }
};
const mutateJson = async <B, R>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: B
): Promise<
  | {
      ok: true;
      data: R;
    }
  | {
      ok: false;
      error: string;
      status: number;
    }
> => {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      //
    }
    let msg = `${res.status}`;
    if (
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (
        parsed as {
          error?: unknown;
        }
      ).error === "string"
    ) {
      msg = (
        parsed as {
          error: string;
        }
      ).error;
    }
    if (!res.ok) {
      return { ok: false, error: msg, status: res.status };
    }
    return { ok: true, data: parsed as R };
  } catch {
    return { ok: false, error: "网络错误", status: 0 };
  }
};
type ChatShellProps = {
  initialConversations: ConversationListItem[];
  viewer?: {
    displayName: string;
    username: string;
    /** 是否为系统里的 ADMIN 角色（首个注册.bootstrap） */
    isAdmin: boolean;
    /** 身份证号匹配后缀时：可审核 / 删除成员 */
    canManageMembers: boolean;
  };
};
export const ChatShell = ({ initialConversations, viewer }: ChatShellProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversations, setConversations] = useState(initialConversations);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [preferEmptySession, setPreferEmptySession] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messagesRetryTick, setMessagesRetryTick] = useState(0);
  const [draft, setDraft] = useState("");
  /** 最近一次发送出错（文案已入库但助手失败时为模型错误提示） */
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState(false);
  /** HITL 按钮终态 / 会话作废：同组 prompt 置灰 */
  const [staleActionKeys, setStaleActionKeys] = useState<Set<string>>(
    () => new Set()
  );
  /** 用户气泡原地编辑 */
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const sendBusyRef = useRef(false);
  const pendingUserTempIdRef = useRef<string | null>(null);
  const isComposingRef = useRef(false);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const [thinkingPanelVisible, setThinkingPanelVisible] = useState(false);
  const [streamThinking, setStreamThinking] = useState("");
  const [streamAnswerPreview, setStreamAnswerPreview] = useState("");
  const [streamBlocks, setStreamBlocks] = useState<AssistantMessageBlock[]>([]);
  const [editingSidebarId, setEditingSidebarId] = useState<string | null>(null);
  const [editSidebarTitleDraft, setEditSidebarTitleDraft] = useState("");
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  type PendingAttachment = {
    id: string;
    file: File;
    name: string;
    size: number;
  };
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const [logPanelOpen, setLogPanelOpen] = useState(false);
  const [conversationLogsById, setConversationLogsById] = useState<
    Map<string, ConversationLogBundle>
  >(() => new Map());
  const attachInputRef = useRef<HTMLInputElement>(null);
  const activeTurnIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamPreviewRef = useRef("");
  /** 刷新后等待后台落库的助手回复：按「会话:末条 userId」限次轮询 */
  const assistPollCountRef = useRef<Map<string, number>>(new Map());
  const [streamingTurnId, setStreamingTurnId] = useState<string | null>(null);
  const speechDraftBaseRef = useRef("");
  const appendSpeechToDraft = useCallback(
    (text: string) => {
      const base = speechDraftBaseRef.current.trim();
      const next = base ? `${base} ${text}` : text;
      speechDraftBaseRef.current = next;
      setDraft(next);
      if (sendError) setSendError(null);
    },
    [sendError]
  );
  const appendInterimSpeechToDraft = useCallback((interim: string) => {
    const base = speechDraftBaseRef.current.trim();
    setDraft(interim ? (base ? `${base} ${interim}` : interim) : base);
  }, []);
  const speech = useSpeechInput({
    onTranscript: appendSpeechToDraft,
    onInterim: appendInterimSpeechToDraft,
    lang: "zh-CN",
  });
  useEffect(() => {
    sendBusyRef.current = sendBusy;
  }, [sendBusy]);
  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);
  /**
   * 模型已出稿即可解锁输入；落库 done 可能更晚。
   * 只改 sendBusy——不碰思考面板/turnId（旧 SSE finally 可能晚于 supersede/编辑重问）。
   */
  const releaseSendLock = useCallback(() => {
    flushSync(() => {
      setSendBusy(false);
    });
  }, []);

  /** 仅当本流仍拥有当前 turn 时清理流式 UI（避免编辑重问后旧流冲掉新思考过程） */
  const clearStreamingUiIfOwned = useCallback(
    (ownedTurnId: string, ownedController: AbortController) => {
      if (abortControllerRef.current === ownedController) {
        abortControllerRef.current = null;
      }
      if (activeTurnIdRef.current !== ownedTurnId) return false;
      activeTurnIdRef.current = null;
      setStreamingTurnId(null);
      setThinkingPanelVisible(false);
      setStreamThinking("");
      setStreamAnswerPreview("");
      setStreamBlocks([]);
      streamPreviewRef.current = "";
      releaseSendLock();
      return true;
    },
    [releaseSendLock]
  );
  const loadConversations = useCallback(async (opts?: { silent?: boolean }) => {
    await Promise.resolve();
    const silent = Boolean(opts?.silent);
    if (!silent) {
      setListLoading(true);
    }
    setListError(null);
    const result =
      await fetchJson<ConversationListItem[]>("/api/conversations");
    if (!silent) {
      setListLoading(false);
    }
    if (result.ok) {
      setConversations(result.data);
    } else {
      setListError(result.error);
      if (!silent) {
        setConversations([]);
      }
    }
  }, []);
  const patchConversation = useCallback(
    async (
      id: string,
      body: {
        title?: string;
        pinned?: boolean;
      }
    ): Promise<boolean> => {
      const result = await mutateJson<typeof body, unknown>(
        `/api/conversations/${id}`,
        "PATCH",
        body
      );
      if (!result.ok) {
        setListError(result.error);
        return false;
      }
      await loadConversations();
      return true;
    },
    [loadConversations]
  );
  /** 置顶：先改本地顺序与状态，失败再回滚 */
  const togglePinOptimistic = useCallback(async (id: string) => {
    let snapshot: ConversationListItem[] = [];
    let nextPinned = false;
    let found = false;
    setListError(null);
    flushSync(() => {
      setConversations((prev) => {
        const t = prev.find((c) => c.id === id);
        if (!t) return prev;
        found = true;
        snapshot = prev.map((c) => ({ ...c }));
        nextPinned = !t.pinned;
        return sortConversationsForSidebar(
          prev.map((c) => (c.id === id ? { ...c, pinned: nextPinned } : c))
        );
      });
    });
    if (!found) return;
    const result = await mutateJson<
      {
        pinned: boolean;
      },
      PatchConversationOk
    >(`/api/conversations/${id}`, "PATCH", { pinned: nextPinned });
    if (!result.ok) {
      flushSync(() => {
        setConversations(snapshot);
      });
      setListError(result.error);
      return;
    }
    const data = result.data;
    if (!isPatchConversationPayload(data)) {
      flushSync(() => {
        setConversations(snapshot);
      });
      setListError("置顶同步失败，请刷新页面");
      return;
    }
    setConversations((cur) =>
      sortConversationsForSidebar(
        cur.map((c) =>
          c.id === id
            ? {
                ...c,
                title: data.title,
                pinned: data.pinned,
                updatedAt: data.updatedAt,
              }
            : c
        )
      )
    );
  }, []);
  const deleteConversationOptimistic = useCallback(
    async (id: string, title: string) => {
      if (sendBusy && activeConversationId === id) {
        setListError("正在生成回复，请稍后再删除");
        return;
      }
      const confirmed = window.confirm(
        `确定删除「${title || "新对话"}」？\n删除后无法恢复。`
      );
      if (!confirmed) return;

      let snapshot: ConversationListItem[] = [];
      let wasActive = false;
      let nextActiveId: string | null = null;
      setListError(null);
      flushSync(() => {
        setConversations((prev) => {
          snapshot = prev.map((c) => ({ ...c }));
          wasActive = activeConversationId === id;
          const remaining = prev.filter((c) => c.id !== id);
          if (wasActive) {
            nextActiveId = remaining[0]?.id ?? null;
            setActiveConversationId(nextActiveId);
            setPreferEmptySession(nextActiveId === null);
            setMessages([]);
            setMessagesError(null);
            setSendError(null);
            setStreamThinking("");
            setStreamAnswerPreview("");
            setThinkingPanelVisible(false);
            pendingUserTempIdRef.current = null;
            setEditingSidebarId(null);
          }
          return sortConversationsForSidebar(remaining);
        });
      });

      const result = await mutateJson<undefined, { ok: boolean }>(
        `/api/conversations/${id}`,
        "DELETE"
      );
      if (!result.ok) {
        flushSync(() => {
          setConversations(snapshot);
          if (wasActive) {
            setActiveConversationId(id);
            setPreferEmptySession(false);
            setMessagesRetryTick((n) => n + 1);
          }
        });
        setListError(result.error);
        return;
      }
    },
    [activeConversationId, sendBusy]
  );
  /** 首轮有数据且无「新会话」偏好时，默认打开最近一条会话 */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (preferEmptySession) return;
      if (activeConversationId != null) return;
      const firstId = conversations[0]?.id;
      if (firstId) setActiveConversationId(firstId);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversations, preferEmptySession, activeConversationId]);
  useEffect(() => {
    setStaleActionKeys(new Set());
  }, [activeConversationId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!activeConversationId) {
        setMessages([]);
        setMessagesLoading(false);
        setMessagesError(null);
        return;
      }
      // 流式回答中勿 refetch：sendBusy 会在首 token 提前解锁，但 streamingTurnId 仍在
      if (sendBusy || streamingTurnId != null) {
        return;
      }
      // 已有消息时后台同步，勿整页「加载消息中…」（会白屏闪缩）
      const showFullPageLoader = messagesRef.current.length === 0;
      if (showFullPageLoader) {
        setMessagesLoading(true);
      }
      setMessagesError(null);
      const [msgResult, traceResult] = await Promise.all([
        fetchJson<ChatMessage[]>(
          `/api/conversations/${activeConversationId}/messages`
        ),
        fetchJson<ConversationLogBundle>(
          `/api/conversations/${activeConversationId}/traces`
        ),
      ]);
      if (cancelled) return;
      if (showFullPageLoader) {
        setMessagesLoading(false);
      }
      if (msgResult.ok) {
        const timingByMessageId = new Map<string, MessageTiming | undefined>();
        if (traceResult.ok) {
          for (const turn of traceResult.data.turns) {
            if (turn.timing) {
              timingByMessageId.set(turn.turnId, turn.timing);
            }
          }
          setConversationLogsById((prev) => {
            const next = new Map(prev);
            next.set(activeConversationId, {
              conversationId: activeConversationId,
              turns: traceResult.data.turns,
            });
            return next;
          });
        }
        setMessages((prev) => {
          const liveTimingById = new Map(
            prev.filter((m) => m.timing).map((m) => [m.id, m.timing] as const)
          );
          const liveCitationsById = new Map(
            prev
              .filter((m) => m.citations?.length)
              .map((m) => [m.id, m.citations] as const)
          );
          return msgResult.data.map((m) => ({
            ...m,
            timing: liveTimingById.get(m.id) ?? timingByMessageId.get(m.id),
            citations:
              liveCitationsById.get(m.id) ??
              parseMessageCitations(
                (m as { citations?: unknown }).citations
              ),
          }));
        });
        // 刷新后末条是用户消息：后台可能仍在生成，短轮询补齐助手（每条 user 最多 2 次）
        const last = msgResult.data[msgResult.data.length - 1];
        if (last?.role === "user") {
          const pollKey = `${activeConversationId}:${last.id}`;
          const n = assistPollCountRef.current.get(pollKey) ?? 0;
          if (n < 2) {
            assistPollCountRef.current.set(pollKey, n + 1);
            const delay = n === 0 ? 2500 : 7000;
            window.setTimeout(() => {
              if (!cancelled) setMessagesRetryTick((x) => x + 1);
            }, delay);
          }
        }
      } else {
        setMessages([]);
        setMessagesError(msgResult.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId, messagesRetryTick, sendBusy, streamingTurnId]);
  /** 生成中跟随最新一行：外层列表滚到底，避免正文/思考长高后仍卡在旧位置 */
  useLayoutEffect(() => {
    if (messagesLoading) return;
    const el = messagesScrollRef.current;
    if (!el) return;
    const streaming =
      sendBusy &&
      (thinkingPanelVisible ||
        Boolean(streamThinking.trim()) ||
        Boolean(streamAnswerPreview.trim()));
    if (!streaming && messages.length === 0) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [
    messages,
    streamThinking,
    streamAnswerPreview,
    sendBusy,
    thinkingPanelVisible,
    messagesLoading,
  ]);
  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) ?? null;
  const activeTitleRaw = activeConversation?.title ?? "新对话";
  const activeTitleShort = shortConversationTitle(activeTitleRaw);
  const startNewChat = useCallback(() => {
    setPreferEmptySession(true);
    setActiveConversationId(null);
    setMessages([]);
    setMessagesError(null);
    setSendError(null);
    setStreamThinking("");
    setStreamAnswerPreview("");
    setStreamBlocks([]);
    setThinkingPanelVisible(false);
    pendingUserTempIdRef.current = null;
    setEditingSidebarId(null);
    setEditSidebarTitleDraft("");
    setDraft("");
    setPendingAttachments([]);
    setUploadNotice(null);
    setStaleActionKeys(new Set());
    setEditingMessageId(null);
    setEditDraft("");
  }, []);

  /** 仅最新一条助手消息的 action 可点；历史气泡一律置灰 */
  const latestAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "assistant") return messages[i]!.id;
    }
    return null;
  }, [messages]);
  const turnInFlight = sendBusy || streamingTurnId != null;
  const hasLiveStreamUi =
    Boolean(streamAnswerPreview.trim()) || streamBlocks.length > 0;
  const updateLogsForConversation = useCallback(
    (
      conversationId: string,
      updater: (bundle: ConversationLogBundle) => ConversationLogBundle
    ) => {
      setConversationLogsById((prev) => {
        const next = new Map(prev);
        const existing = next.get(conversationId) ?? {
          conversationId,
          turns: [],
        };
        next.set(conversationId, updater(existing));
        return next;
      });
    },
    []
  );
  const patchActiveTurnLog = useCallback(
    (
      conversationId: string,
      turnId: string,
      patch: (turn: ConversationTurnLog) => ConversationTurnLog
    ) => {
      updateLogsForConversation(conversationId, (bundle) =>
        patchTurnLog(bundle, turnId, patch)
      );
    },
    [updateLogsForConversation]
  );
  /** 停止当前 turn：显式 cancel API + Abort（supersede 时 reason=superseded） */
  const stopActiveTurn = useCallback(
    async (reason: "cancelled" | "superseded") => {
      const turnId = activeTurnIdRef.current;
      const convId = activeConversationId;
      const controller = abortControllerRef.current;
      if (!turnId) return;
      if (controller && !controller.signal.aborted) {
        controller.abort();
      }
      abortControllerRef.current = null;
      let assistantFromServer: ChatMessage | null = null;
      if (convId) {
        try {
          const res = await fetch(
            `/api/conversations/${convId}/turns/${turnId}/cancel`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({ reason }),
            }
          );
          if (res.ok) {
            const body = (await res.json()) as {
              assistantMessage?: ChatMessage | null;
            };
            if (
              body.assistantMessage &&
              typeof body.assistantMessage.id === "string" &&
              typeof body.assistantMessage.content === "string"
            ) {
              assistantFromServer = {
                id: body.assistantMessage.id,
                role: "assistant",
                content: body.assistantMessage.content,
              };
            }
          }
        } catch {
          //
        }
        patchActiveTurnLog(convId, turnId, (turn) => ({
          ...turn,
          status: reason,
        }));
      }
      if (reason === "cancelled") {
        const preview = streamPreviewRef.current.trim();
        const fallback =
          preview && !preview.endsWith("用户已暂停")
            ? `${preview}${USER_PAUSED_SUFFIX}`
            : preview || null;
        const assistant =
          assistantFromServer ??
          (fallback
            ? {
                id: `local-cancel:${turnId}`,
                role: "assistant" as const,
                content: fallback,
              }
            : null);
        if (assistant) {
          flushSync(() => {
            setMessages((prev) => {
              const rest = prev.filter(
                (m) =>
                  m.id !== assistant.id && m.id !== `local-cancel:${turnId}`
              );
              return [...rest, assistant];
            });
          });
        }
      }
      activeTurnIdRef.current = null;
      setStreamingTurnId(null);
      streamPreviewRef.current = "";
      setStreamAnswerPreview("");
      setStreamBlocks([]);
      setThinkingPanelVisible(false);
      setStreamThinking("");
      releaseSendLock();
    },
    [activeConversationId, patchActiveTurnLog, releaseSendLock]
  );

  const markStaleActionKey = useCallback((key: string | null | undefined) => {
    if (!key) return;
    setStaleActionKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const sendMessageWithContent = useCallback(
    async (
      content: string,
      options?: {
        displayContent?: string;
        staleGroupKey?: string | null;
        /** 点击的助手消息：整条 actions 作废（对齐 HITL 提案消费） */
        staleMessageId?: string | null;
      }
    ) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const displayContent =
        (options?.displayContent ?? trimmed).trim() || trimmed;
      // 首 token 前 sendBusy 防连点；流式中允许再发 → supersede
      if (sendBusy && !streamingTurnId) return;
      if (streamingTurnId || activeTurnIdRef.current) {
        await stopActiveTurn("superseded");
      }
      setSendBusy(true);
      setSendError(null);
      setUploadNotice(null);
      setStreamThinking("");
      setStreamAnswerPreview("");
      streamPreviewRef.current = "";
      setStreamBlocks([]);
      setThinkingPanelVisible(false);
      // 与 HITL 同套：group key + 源消息 / 当前最新助手消息一并作废
      markStaleActionKey(
        options?.staleGroupKey ?? chatActionStaleGroupKey(trimmed)
      );
      const msgToStale =
        options?.staleMessageId ??
        (() => {
          for (let i = messagesRef.current.length - 1; i >= 0; i -= 1) {
            if (messagesRef.current[i]?.role === "assistant") {
              return messagesRef.current[i]!.id;
            }
          }
          return null;
        })();
      if (msgToStale) markStaleActionKey(messageActionStaleKey(msgToStale));

      // 发送即带走附件：先挂到用户气泡并清空输入区芯片（抽取失败也不再留在下方）
      const pendingFiles = [...pendingAttachmentsRef.current];
      const attachNote =
        pendingFiles.length > 0
          ? `\n\n[附件 ${pendingFiles.map((a) => a.name).join("、")}]`
          : "";
      const userBubbleContent = `${displayContent}${attachNote}`;
      setPendingAttachments([]);
      pendingAttachmentsRef.current = [];
      setDraft("");

      const tempUserId = `temp:${crypto.randomUUID()}`;
      pendingUserTempIdRef.current = tempUserId;
      const turnId = crypto.randomUUID();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      activeTurnIdRef.current = turnId;
      setStreamingTurnId(turnId);

      let attachmentBatchId: string | undefined;
      try {
        let convId = activeConversationId;
        if (!convId) {
          const created = await mutateJson<
            Record<string, unknown>,
            {
              id: string;
            }
          >("/api/conversations", "POST", {});
          if (!created.ok) {
            setSendError(created.error);
            pendingUserTempIdRef.current = null;
            activeTurnIdRef.current = null;
            setStreamingTurnId(null);
            abortControllerRef.current = null;
            releaseSendLock();
            return;
          }
          convId = created.data.id;
        }
        setPreferEmptySession(false);
        setActiveConversationId(convId);
        setMessages((prev) => [
          ...prev,
          { id: tempUserId, role: "user", content: userBubbleContent },
        ]);
        updateLogsForConversation(convId, (bundle) =>
          appendTurnToBundle(bundle, createTurnLog(turnId, userBubbleContent))
        );

        if (pendingFiles.length > 0) {
          setUploadBusy(true);
          setThinkingPanelVisible(true);
          setStreamThinking("正在抽取附件文字…");
          const outcome = await extractDocuments({
            files: pendingFiles.map((a) => ({
              file: a.file,
              relativePath: a.name,
            })),
            signal: controller.signal,
          });
          setUploadBusy(false);
          if (!outcome.ok) {
            setSendError(outcome.error);
            setThinkingPanelVisible(false);
            setStreamThinking("");
            activeTurnIdRef.current = null;
            setStreamingTurnId(null);
            abortControllerRef.current = null;
            releaseSendLock();
            return;
          }
          attachmentBatchId = outcome.result.batchId;
          // 抽取成功后不常驻提示；失败才用 sendError
          setUploadNotice(null);
        }
        type MetaPayload = {
          userMessage: ChatMessage;
        };
        type DonePayload = {
          userMessage?: ChatMessage;
          assistantMessage?: ChatMessage;
          timing?: PipelineTiming;
          aborted?: boolean;
          reason?: "cancelled" | "superseded";
        };
        const clientStartedAt = performance.now();
        let latestTiming: PipelineTiming | undefined;
        const res = await fetch(`/api/conversations/${convId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            content: userBubbleContent,
            ...(displayContent !== trimmed || attachNote
              ? { routingContent: trimmed }
              : {}),
            turnId,
            ...(attachmentBatchId ? { attachmentBatchId } : {}),
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          let msg = `${res.status}`;
          try {
            const raw = await res.json();
            if (raw?.error && typeof raw.error === "string") msg = raw.error;
          } catch {
            //
          }
          setSendError(msg);
          pendingUserTempIdRef.current = null;
          setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
          activeTurnIdRef.current = null;
          setStreamingTurnId(null);
          abortControllerRef.current = null;
          await loadConversations({ silent: true });
          setMessagesRetryTick((n) => n + 1);
          return;
        }
        if (!res.body) {
          setSendError("无法读取服务器流");
          pendingUserTempIdRef.current = null;
          setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
          activeTurnIdRef.current = null;
          setStreamingTurnId(null);
          abortControllerRef.current = null;
          await loadConversations({ silent: true });
          setMessagesRetryTick((n) => n + 1);
          return;
        }
        let streamFatal: string | null = null;
        let streamAborted = false;
        const applyTurnTiming = (
          timing: PipelineTiming,
          clientTotalMs?: number
        ) => {
          const tid = activeTurnIdRef.current;
          if (!tid) return;
          patchActiveTurnLog(convId, tid, (turn) => ({
            ...turn,
            timing: {
              ...timing,
              ...(clientTotalMs != null ? { clientTotalMs } : {}),
            },
          }));
        };
        await consumeSse(
          res.body,
          (event, payload) => {
            if (
              event === "pipeline_log" &&
              payload &&
              typeof payload === "object" &&
              payload !== null
            ) {
              const entry = (payload as { entry?: PipelineLogEntry }).entry;
              if (entry && activeTurnIdRef.current === turnId) {
                patchActiveTurnLog(convId, turnId, (turn) => ({
                  ...turn,
                  entries: [...turn.entries, entry],
                }));
              }
            }
            if (
              event === "meta" &&
              payload &&
              typeof payload === "object" &&
              payload !== null
            ) {
              const p = payload as MetaPayload;
              if (typeof p.userMessage?.id === "string") {
                pendingUserTempIdRef.current = null;
                const real = p.userMessage;
                setMessages((prev) =>
                  prev.map((m) => (m.id === tempUserId ? real : m))
                );
              }
            }
            if (
              event === "ready" &&
              payload &&
              typeof payload === "object" &&
              payload !== null &&
              activeTurnIdRef.current === turnId
            ) {
              const p = payload as {
                answer?: string;
                timing?: PipelineTiming;
              };
              if (p.timing && typeof p.timing.totalMs === "number") {
                latestTiming = p.timing;
                applyTurnTiming(p.timing);
              }
              if (typeof p.answer === "string" && p.answer.trim()) {
                streamPreviewRef.current = p.answer;
                setStreamAnswerPreview(p.answer);
              }
              releaseSendLock();
            }
            if (
              event === "pipeline_timing" &&
              payload &&
              typeof payload === "object" &&
              payload !== null &&
              activeTurnIdRef.current === turnId
            ) {
              const t = (payload as { timing?: PipelineTiming }).timing;
              if (t && typeof t.totalMs === "number") {
                latestTiming = t;
                applyTurnTiming(t);
              }
              releaseSendLock();
            }
            if (
              event === "step" &&
              payload &&
              typeof payload === "object" &&
              payload !== null
            ) {
              const p = payload as {
                name?: string;
                status?: string;
                durationMs?: number;
              };
              if (
                activeTurnIdRef.current === turnId &&
                typeof p.name === "string" &&
                (p.status === "running" || p.status === "done")
              ) {
                patchActiveTurnLog(convId, turnId, (turn) => ({
                  ...turn,
                  steps: upsertStep(turn.steps, {
                    name: p.name as PipelineStepName,
                    status: p.status as "running" | "done",
                    durationMs: p.durationMs,
                  }),
                }));
              }
              if (
                p.status === "running" &&
                typeof p.name === "string" &&
                activeTurnIdRef.current === turnId
              ) {
                setThinkingPanelVisible(true);
                setStreamThinking(STEP_RUNNING_LABELS[p.name] ?? "处理中…");
              }
              if (
                p.status === "done" &&
                p.name === "analyst" &&
                activeTurnIdRef.current === turnId
              ) {
                releaseSendLock();
              }
            }
            if (
              event === "thinking" &&
              payload &&
              typeof payload === "object" &&
              payload !== null
            ) {
              const t = (
                payload as {
                  text?: string;
                }
              ).text;
              if (
                typeof t === "string" &&
                t.trim() &&
                activeTurnIdRef.current === turnId
              ) {
                setThinkingPanelVisible(true);
                setStreamThinking(t);
              }
            }
            if (
              event === "ui_block" &&
              payload &&
              typeof payload === "object" &&
              payload !== null
            ) {
              const block = (payload as { block?: AssistantMessageBlock })
                .block;
              if (
                block &&
                typeof block === "object" &&
                activeTurnIdRef.current === turnId
              ) {
                setStreamBlocks((prev) => [...prev, block]);
              }
            }
            if (
              event === "assistant_message" &&
              payload &&
              typeof payload === "object" &&
              payload !== null
            ) {
              const message = (
                payload as {
                  message?: { blocks?: AssistantMessageBlock[] };
                }
              ).message;
              if (
                message?.blocks?.length &&
                activeTurnIdRef.current === turnId
              ) {
                setStreamBlocks(message.blocks);
              }
            }
            if (
              event === "assistant" &&
              payload &&
              typeof payload === "object" &&
              payload !== null
            ) {
              const t = (
                payload as {
                  text?: string;
                }
              ).text;
              if (typeof t === "string" && activeTurnIdRef.current === turnId) {
                setThinkingPanelVisible(false);
                setStreamThinking("");
                streamPreviewRef.current = t;
                setStreamAnswerPreview(t);
                if (t.trim()) {
                  releaseSendLock();
                }
              }
            }
            if (
              event === "aborted" &&
              payload &&
              typeof payload === "object" &&
              payload !== null
            ) {
              streamAborted = true;
              const p = payload as {
                turnId?: string;
                reason?: "cancelled" | "superseded";
                assistantMessage?: ChatMessage;
              };
              const tid = typeof p.turnId === "string" ? p.turnId : turnId;
              const reason = p.reason ?? "cancelled";
              patchActiveTurnLog(convId, tid, (t) => ({
                ...t,
                status: reason,
              }));
              // 已被 supersede/编辑重问接棒：只记账，不碰新 turn 的思考/预览
              if (activeTurnIdRef.current !== turnId) {
                return;
              }
              // 停止按钮路径已用 cancel 响应更新过 UI，此处仅补齐未展示的截停稿
              if (
                reason === "cancelled" &&
                p.assistantMessage &&
                typeof p.assistantMessage.content === "string"
              ) {
                const assistant: ChatMessage = {
                  id: p.assistantMessage.id,
                  role: "assistant",
                  content: p.assistantMessage.content,
                  createdAt:
                    typeof (p.assistantMessage as { createdAt?: unknown })
                      .createdAt === "string"
                      ? (p.assistantMessage as { createdAt: string }).createdAt
                      : new Date().toISOString(),
                };
                flushSync(() => {
                  setMessages((prev) => {
                    const withoutLocal = prev.filter(
                      (m) => m.id !== `local-cancel:${tid}`
                    );
                    if (withoutLocal.some((m) => m.id === assistant.id)) {
                      return withoutLocal.map((m) =>
                        m.id === assistant.id ? assistant : m
                      );
                    }
                    return [...withoutLocal, assistant];
                  });
                });
              }
              clearStreamingUiIfOwned(turnId, controller);
              pendingUserTempIdRef.current = null;
            }
            if (
              event === "done" &&
              payload &&
              typeof payload === "object" &&
              payload !== null
            ) {
              const p = payload as DonePayload;
              if (p.aborted || streamAborted) {
                patchActiveTurnLog(convId, turnId, (t) => ({
                  ...t,
                  status: p.reason ?? "cancelled",
                }));
                if (activeTurnIdRef.current === turnId) {
                  clearStreamingUiIfOwned(turnId, controller);
                  pendingUserTempIdRef.current = null;
                }
                return;
              }
              if (activeTurnIdRef.current !== turnId) {
                return;
              }
              const clientTotalMs = Math.round(
                performance.now() - clientStartedAt
              );
              const serverTiming = p.timing ?? latestTiming;
              const timing: MessageTiming | undefined = serverTiming
                ? { ...serverTiming, clientTotalMs }
                : undefined;
              if (serverTiming) applyTurnTiming(serverTiming, clientTotalMs);
              const assistantId =
                p.assistantMessage && typeof p.assistantMessage.id === "string"
                  ? p.assistantMessage.id
                  : null;
              patchActiveTurnLog(convId, turnId, (t) => ({
                ...t,
                ...(assistantId ? { turnId: assistantId } : {}),
                status: "done",
                timing: timing ?? t.timing,
              }));
              pendingUserTempIdRef.current = null;
              if (
                p.assistantMessage &&
                typeof p.assistantMessage.id === "string" &&
                typeof p.assistantMessage.content === "string"
              ) {
                const assistant: ChatMessage = {
                  id: p.assistantMessage.id,
                  role: "assistant",
                  content: p.assistantMessage.content,
                  createdAt:
                    typeof (p.assistantMessage as { createdAt?: unknown })
                      .createdAt === "string"
                      ? (p.assistantMessage as { createdAt: string }).createdAt
                      : new Date().toISOString(),
                  timing,
                  retrievalPaths: Array.isArray(
                    (p.assistantMessage as { retrievalPaths?: unknown })
                      .retrievalPaths
                  )
                    ? (p.assistantMessage as { retrievalPaths: string[] })
                        .retrievalPaths
                    : undefined,
                  blocks: Array.isArray(
                    (p.assistantMessage as { blocks?: unknown }).blocks
                  )
                    ? (
                        p.assistantMessage as {
                          blocks: AssistantMessageBlock[];
                        }
                      ).blocks
                    : undefined,
                  citations: parseMessageCitations(
                    (p.assistantMessage as { citations?: unknown }).citations
                  ),
                };
                flushSync(() => {
                  setMessages((prev) => {
                    const rest = prev.filter((m) => m.id !== assistant.id);
                    return [...rest, assistant];
                  });
                });
              }
              clearStreamingUiIfOwned(turnId, controller);
            }
            if (
              event === "error" &&
              payload &&
              typeof payload === "object" &&
              payload !== null
            ) {
              const e =
                (
                  payload as {
                    error?: string;
                    message?: string;
                  }
                ).error ?? (payload as { message?: string }).message;
              streamFatal = typeof e === "string" ? e : "模型出错";
              patchActiveTurnLog(convId, turnId, (t) => ({
                ...t,
                status: "error",
                error: streamFatal ?? undefined,
              }));
              if (activeTurnIdRef.current === turnId) {
                clearStreamingUiIfOwned(turnId, controller);
              }
            }
          },
          controller.signal
        );
        if (streamFatal) {
          setSendError(streamFatal);
        }
        void loadConversations({ silent: true });
        setMessagesRetryTick((n) => n + 1);
      } catch (e) {
        const aborted =
          (e instanceof DOMException && e.name === "AbortError") ||
          (e instanceof Error && e.name === "AbortError") ||
          controller.signal.aborted;
        if (!aborted) {
          setSendError("网络错误");
          pendingUserTempIdRef.current = null;
          setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
          clearStreamingUiIfOwned(turnId, controller);
        } else if (activeTurnIdRef.current === turnId) {
          // 本 turn 被 abort 且未接棒：收尾 UI
          clearStreamingUiIfOwned(turnId, controller);
          pendingUserTempIdRef.current = null;
        }
        await loadConversations({ silent: true });
        setMessagesRetryTick((n) => n + 1);
      } finally {
        // supersede / 编辑重问后旧流不得清新 turn
        if (activeTurnIdRef.current === turnId) {
          clearStreamingUiIfOwned(turnId, controller);
          pendingUserTempIdRef.current = null;
        } else if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [
      activeConversationId,
      clearStreamingUiIfOwned,
      loadConversations,
      markStaleActionKey,
      patchActiveTurnLog,
      releaseSendLock,
      sendBusy,
      stopActiveTurn,
      streamingTurnId,
      updateLogsForConversation,
    ]
  );

  const handleChatAction = useCallback(
    (action: ChatActionPayload) => {
      if (action.clientHandler === "open_editor") {
        return;
      }
      void sendMessageWithContent(action.prompt, {
        displayContent: action.displayText ?? action.label,
        staleGroupKey: chatActionStaleGroupKey(action.prompt),
        staleMessageId: action.sourceMessageId ?? null,
      });
    },
    [sendMessageWithContent]
  );

  const sendMessage = useCallback(async () => {
    await sendMessageWithContent(draft);
  }, [draft, sendMessageWithContent]);

  const canEditUserMessage = useCallback((m: ChatMessage): boolean => {
    if (m.role !== "user") return false;
    if (m.id.startsWith("temp:")) return false;
    // HITL 内部 prompt 不提供编辑（展示文案按钮另当别论）
    if (m.content.trim().startsWith("__FAMBRAIN_")) return false;
    return true;
  }, []);

  const beginEditUserMessage = useCallback(
    (m: ChatMessage) => {
      if (!canEditUserMessage(m)) return;
      setEditingMessageId(m.id);
      setEditDraft(m.content);
      setSendError(null);
    },
    [canEditUserMessage]
  );

  const cancelEditUserMessage = useCallback(() => {
    setEditingMessageId(null);
    setEditDraft("");
  }, []);

  /** 原地改用户气泡 → 截断后续 → edit-regenerate SSE */
  const commitEditUserMessage = useCallback(async () => {
    const messageId = editingMessageId;
    const content = editDraft.trim();
    if (!messageId || !content) return;
    const convId = activeConversationId;
    if (!convId) return;
    if (sendBusy && !streamingTurnId) return;

    if (streamingTurnId || activeTurnIdRef.current) {
      await stopActiveTurn("superseded");
    }

    setEditingMessageId(null);
    setEditDraft("");
    setSendBusy(true);
    setSendError(null);
    setStreamThinking("");
    setStreamAnswerPreview("");
    streamPreviewRef.current = "";
    setStreamBlocks([]);
    setThinkingPanelVisible(false);

    // 本地先截断并替换文案
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx < 0) return prev;
      const head = prev.slice(0, idx);
      return [...head, { ...prev[idx]!, content }];
    });

    const turnId = crypto.randomUUID();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    activeTurnIdRef.current = turnId;
    setStreamingTurnId(turnId);
    updateLogsForConversation(convId, (bundle) =>
      appendTurnToBundle(bundle, createTurnLog(turnId, content))
    );

    type DonePayload = {
      userMessage?: ChatMessage;
      assistantMessage?: ChatMessage;
      timing?: PipelineTiming;
      aborted?: boolean;
      reason?: "cancelled" | "superseded";
    };

    try {
      const clientStartedAt = performance.now();
      let latestTiming: PipelineTiming | undefined;
      const res = await fetch(
        `/api/conversations/${convId}/messages/${messageId}/edit-regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ content, turnId }),
          signal: controller.signal,
        }
      );
      if (!res.ok) {
        let msg = `${res.status}`;
        try {
          const raw = await res.json();
          if (raw?.error && typeof raw.error === "string") msg = raw.error;
        } catch {
          //
        }
        setSendError(msg);
        activeTurnIdRef.current = null;
        setStreamingTurnId(null);
        abortControllerRef.current = null;
        await loadConversations({ silent: true });
        setMessagesRetryTick((n) => n + 1);
        return;
      }
      if (!res.body) {
        setSendError("无法读取服务器流");
        activeTurnIdRef.current = null;
        setStreamingTurnId(null);
        abortControllerRef.current = null;
        return;
      }

      let streamFatal: string | null = null;
      let streamAborted = false;
      const applyTurnTiming = (
        timing: PipelineTiming,
        clientTotalMs?: number
      ) => {
        const tid = activeTurnIdRef.current;
        if (!tid) return;
        patchActiveTurnLog(convId, tid, (turn) => ({
          ...turn,
          timing: {
            ...timing,
            ...(clientTotalMs != null ? { clientTotalMs } : {}),
          },
        }));
      };

      await consumeSse(
        res.body,
        (event, payload) => {
          if (
            event === "pipeline_log" &&
            payload &&
            typeof payload === "object" &&
            payload !== null
          ) {
            const entry = (payload as { entry?: PipelineLogEntry }).entry;
            if (entry && activeTurnIdRef.current === turnId) {
              patchActiveTurnLog(convId, turnId, (turn) => ({
                ...turn,
                entries: [...turn.entries, entry],
              }));
            }
          }
          if (
            event === "meta" &&
            payload &&
            typeof payload === "object" &&
            payload !== null
          ) {
            const p = payload as { userMessage?: ChatMessage };
            if (typeof p.userMessage?.id === "string") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === p.userMessage!.id
                    ? { ...m, content: p.userMessage!.content }
                    : m
                )
              );
            }
          }
          if (
            event === "ready" &&
            payload &&
            typeof payload === "object" &&
            payload !== null &&
            activeTurnIdRef.current === turnId
          ) {
            const p = payload as { answer?: string; timing?: PipelineTiming };
            if (p.timing && typeof p.timing.totalMs === "number") {
              latestTiming = p.timing;
              applyTurnTiming(p.timing);
            }
            if (typeof p.answer === "string" && p.answer.trim()) {
              streamPreviewRef.current = p.answer;
              setStreamAnswerPreview(p.answer);
            }
            releaseSendLock();
          }
          if (
            event === "pipeline_timing" &&
            payload &&
            typeof payload === "object" &&
            payload !== null &&
            activeTurnIdRef.current === turnId
          ) {
            const t = (payload as { timing?: PipelineTiming }).timing;
            if (t && typeof t.totalMs === "number") {
              latestTiming = t;
              applyTurnTiming(t);
            }
            releaseSendLock();
          }
          if (
            event === "step" &&
            payload &&
            typeof payload === "object" &&
            payload !== null
          ) {
            const p = payload as {
              name?: string;
              status?: string;
              durationMs?: number;
            };
            if (
              activeTurnIdRef.current === turnId &&
              typeof p.name === "string" &&
              (p.status === "running" || p.status === "done")
            ) {
              patchActiveTurnLog(convId, turnId, (turn) => ({
                ...turn,
                steps: upsertStep(turn.steps, {
                  name: p.name as PipelineStepName,
                  status: p.status as "running" | "done",
                  durationMs: p.durationMs,
                }),
              }));
            }
            if (
              p.status === "running" &&
              typeof p.name === "string" &&
              activeTurnIdRef.current === turnId
            ) {
              setThinkingPanelVisible(true);
              setStreamThinking(STEP_RUNNING_LABELS[p.name] ?? "处理中…");
            }
            if (
              p.status === "done" &&
              p.name === "analyst" &&
              activeTurnIdRef.current === turnId
            ) {
              releaseSendLock();
            }
          }
          if (
            event === "thinking" &&
            payload &&
            typeof payload === "object" &&
            payload !== null
          ) {
            const t = (payload as { text?: string }).text;
            if (
              typeof t === "string" &&
              t.trim() &&
              activeTurnIdRef.current === turnId
            ) {
              setThinkingPanelVisible(true);
              setStreamThinking(t);
            }
          }
          if (
            event === "ui_block" &&
            payload &&
            typeof payload === "object" &&
            payload !== null
          ) {
            const block = (payload as { block?: AssistantMessageBlock }).block;
            if (
              block &&
              typeof block === "object" &&
              activeTurnIdRef.current === turnId
            ) {
              setStreamBlocks((prev) => [...prev, block]);
            }
          }
          if (
            event === "assistant" &&
            payload &&
            typeof payload === "object" &&
            payload !== null
          ) {
            const t = (payload as { text?: string }).text;
            if (typeof t === "string" && activeTurnIdRef.current === turnId) {
              setThinkingPanelVisible(false);
              setStreamThinking("");
              streamPreviewRef.current = t;
              setStreamAnswerPreview(t);
              if (t.trim()) releaseSendLock();
            }
          }
          if (
            event === "aborted" &&
            payload &&
            typeof payload === "object" &&
            payload !== null
          ) {
            streamAborted = true;
            const p = payload as {
              turnId?: string;
              reason?: "cancelled" | "superseded";
            };
            const tid = typeof p.turnId === "string" ? p.turnId : turnId;
            patchActiveTurnLog(convId, tid, (t) => ({
              ...t,
              status: p.reason ?? "cancelled",
            }));
            if (activeTurnIdRef.current === turnId) {
              clearStreamingUiIfOwned(turnId, controller);
            }
          }
          if (
            event === "done" &&
            payload &&
            typeof payload === "object" &&
            payload !== null
          ) {
            const p = payload as DonePayload;
            if (p.aborted || streamAborted) {
              patchActiveTurnLog(convId, turnId, (t) => ({
                ...t,
                status: p.reason ?? "cancelled",
              }));
              if (activeTurnIdRef.current === turnId) {
                clearStreamingUiIfOwned(turnId, controller);
              }
              return;
            }
            if (activeTurnIdRef.current !== turnId) {
              return;
            }
            const clientTotalMs = Math.round(
              performance.now() - clientStartedAt
            );
            const serverTiming = p.timing ?? latestTiming;
            const timing: MessageTiming | undefined = serverTiming
              ? { ...serverTiming, clientTotalMs }
              : undefined;
            if (serverTiming) applyTurnTiming(serverTiming, clientTotalMs);
            const assistantId =
              p.assistantMessage && typeof p.assistantMessage.id === "string"
                ? p.assistantMessage.id
                : null;
            patchActiveTurnLog(convId, turnId, (turn) => ({
              ...turn,
              ...(assistantId ? { turnId: assistantId } : {}),
              status: "done",
              timing: timing ?? turn.timing,
            }));
            if (
              p.assistantMessage &&
              typeof p.assistantMessage.id === "string" &&
              typeof p.assistantMessage.content === "string"
            ) {
              const assistant: ChatMessage = {
                id: p.assistantMessage.id,
                role: "assistant",
                content: p.assistantMessage.content,
                timing,
                retrievalPaths: Array.isArray(
                  (p.assistantMessage as { retrievalPaths?: unknown })
                    .retrievalPaths
                )
                  ? (p.assistantMessage as { retrievalPaths: string[] })
                      .retrievalPaths
                  : undefined,
                blocks: Array.isArray(
                  (p.assistantMessage as { blocks?: unknown }).blocks
                )
                  ? (p.assistantMessage as { blocks: AssistantMessageBlock[] })
                      .blocks
                  : undefined,
                citations: parseMessageCitations(
                  (p.assistantMessage as { citations?: unknown }).citations
                ),
              };
              flushSync(() => {
                setMessages((prev) => {
                  const rest = prev.filter((m) => m.id !== assistant.id);
                  return [...rest, assistant];
                });
              });
            }
            clearStreamingUiIfOwned(turnId, controller);
          }
          if (
            event === "error" &&
            payload &&
            typeof payload === "object" &&
            payload !== null
          ) {
            const e =
              (payload as { error?: string; message?: string }).error ??
              (payload as { message?: string }).message;
            streamFatal = typeof e === "string" ? e : "模型出错";
            patchActiveTurnLog(convId, turnId, (t) => ({
              ...t,
              status: "error",
              error: streamFatal ?? undefined,
            }));
            if (activeTurnIdRef.current === turnId) {
              clearStreamingUiIfOwned(turnId, controller);
            }
          }
        },
        controller.signal
      );

      if (streamFatal) setSendError(streamFatal);
      void loadConversations({ silent: true });
      setMessagesRetryTick((n) => n + 1);
    } catch (e) {
      const aborted =
        (e instanceof DOMException && e.name === "AbortError") ||
        (e instanceof Error && e.name === "AbortError") ||
        controller.signal.aborted;
      if (!aborted) {
        setSendError("网络错误");
        clearStreamingUiIfOwned(turnId, controller);
      } else if (activeTurnIdRef.current === turnId) {
        clearStreamingUiIfOwned(turnId, controller);
      }
      await loadConversations({ silent: true });
      setMessagesRetryTick((n) => n + 1);
    } finally {
      if (activeTurnIdRef.current === turnId) {
        clearStreamingUiIfOwned(turnId, controller);
      } else if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [
    activeConversationId,
    clearStreamingUiIfOwned,
    editDraft,
    editingMessageId,
    loadConversations,
    patchActiveTurnLog,
    releaseSendLock,
    sendBusy,
    stopActiveTurn,
    streamingTurnId,
    updateLogsForConversation,
  ]);

  const applySuggestion = (text: string) => {
    setDraft(text);
    setSendError(null);
  };
  /** 「+」仅本地挂起；发送时再抽取（取消不耗 OCR） */
  const handleAttachPick = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length || uploadBusy || sendBusy) return;
      setUploadNotice(null);
      const items = filesFromInput(fileList);
      setPendingAttachments((prev) => {
        const next = [...prev];
        for (const item of items) {
          if (next.length >= 20) break;
          next.push({
            id: crypto.randomUUID(),
            file: item.file,
            name: item.file.name,
            size: item.file.size,
          });
        }
        return next;
      });
    },
    [sendBusy, uploadBusy]
  );
  const removePendingAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);
  const isFreshNewChatUi =
    activeConversationId == null && !messagesLoading && messages.length === 0;
  /** 新开对话且尚未选定会话时的欢迎区 */
  const showingEmptyLanding = isFreshNewChatUi && !sendBusy;
  const activeLogBundle =
    activeConversationId != null
      ? (conversationLogsById.get(activeConversationId) ?? {
          conversationId: activeConversationId,
          turns: [],
        })
      : null;
  /** 首条消息已发出、会话尚在创建或模型推理中 */
  const sendingFirstOnNewChat =
    activeConversationId == null && sendBusy && messages.length === 0;
  const showAssistantPending =
    sendBusy &&
    !streamThinking.trim() &&
    !streamAnswerPreview.trim() &&
    !(
      messages.length > 0 && messages[messages.length - 1]?.role === "assistant"
    );
  return (
    <div className="flex h-dvh bg-[#f3f4f6] text-[#1f2937]">
      <aside
        className={[
          "flex shrink-0 flex-col border-r border-[#e5e7eb] bg-[#f9fafb] transition-[width]",
          sidebarCollapsed
            ? "w-0 overflow-hidden border-r-0 opacity-0"
            : "w-[260px] opacity-100",
        ].join(" ")}
        aria-hidden={sidebarCollapsed}
      >
        <div className="flex h-14 items-center gap-2 border-b border-[#eceeef] px-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef2ff] text-sm font-semibold text-[#4f46e5]">
            FB
          </div>
          <span className="truncate text-[15px] font-semibold tracking-tight text-[#111827]">
            FamBrain
          </span>
        </div>

        <div className="px-3 pt-3 pb-2 text-[13px] text-[#9ca3af]">
          历史对话
        </div>
        <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
          {listLoading ? (
            <li className="px-3 py-6 text-center text-[13px] text-[#9ca3af]">
              加载列表中…
            </li>
          ) : listError ? (
            <li className="px-3 py-4 text-[13px] text-red-600">
              <span className="block">{listError}</span>
              <button
                type="button"
                onClick={() => void loadConversations()}
                className="mt-2 text-[13px] font-medium text-[#4f46e5] hover:underline"
              >
                重试
              </button>
            </li>
          ) : conversations.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] text-[#9ca3af]">
              暂无历史对话
            </li>
          ) : (
            conversations.map((c) => {
              const selected = activeConversationId === c.id;
              const editing = editingSidebarId === c.id;
              return (
                <li key={c.id} className="group relative">
                  {editing ? (
                    <form
                      className="flex flex-col gap-2 rounded-xl border border-[#e5e7eb] bg-white px-2.5 py-2 shadow-sm"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const t = editSidebarTitleDraft.trim();
                        if (!t) return;
                        void (async () => {
                          const ok = await patchConversation(c.id, {
                            title: t,
                          });
                          if (ok) setEditingSidebarId(null);
                        })();
                      }}
                    >
                      <input
                        value={editSidebarTitleDraft}
                        onChange={(e) =>
                          setEditSidebarTitleDraft(e.target.value)
                        }
                        className="w-full rounded-lg border border-[#e5e7eb] px-2 py-1.5 text-[13px] text-[#111827] outline-none focus:border-[#4f46e5]"
                        autoFocus
                        maxLength={512}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-[12px] text-[#6b7280] hover:bg-[#f3f4f6]"
                          onClick={() => setEditingSidebarId(null)}
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          className="rounded-lg bg-[#4f46e5] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#4338ca]"
                        >
                          保存
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      className={[
                        "group relative flex items-center gap-0.5 rounded-lg transition-colors",
                        selected ? "bg-[#ececee]" : "hover:bg-black/[0.04]",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSidebarId(null);
                          setPreferEmptySession(false);
                          setStaleActionKeys(new Set());
                          setStreamThinking("");
                          setStreamAnswerPreview("");
                          setStreamBlocks([]);
                          setActiveConversationId(c.id);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#e8e8ea] bg-white text-[#a1a1aa]">
                          {c.pinned ? (
                            <IconPin
                              active
                              className="h-3.5 w-3.5 text-amber-500"
                            />
                          ) : (
                            <IconChat />
                          )}
                        </span>
                        <span
                          className="min-w-0 flex-1 truncate text-[14px] text-[#374151]"
                          title={
                            c.title !== shortConversationTitle(c.title)
                              ? c.title
                              : undefined
                          }
                        >
                          {shortConversationTitle(c.title)}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5 pr-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label={c.pinned ? "取消置顶" : "置顶"}
                          title={c.pinned ? "取消置顶" : "置顶"}
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            void togglePinOptimistic(c.id);
                          }}
                          className={[
                            "flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/[0.06]",
                            c.pinned
                              ? "text-amber-500"
                              : "text-[#9ca3af] hover:text-amber-500",
                          ].join(" ")}
                        >
                          <IconPin active={c.pinned} />
                        </button>
                        <button
                          type="button"
                          aria-label="修改标题"
                          title="修改标题"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            setEditingSidebarId(c.id);
                            setEditSidebarTitleDraft(c.title);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[#9ca3af] hover:bg-black/[0.06] hover:text-[#4f46e5] pt-3"
                        >
                          <IconEditTitle />
                        </button>
                        <button
                          type="button"
                          aria-label="删除对话"
                          title="删除对话"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            void deleteConversationOptimistic(c.id, c.title);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[#9ca3af] hover:bg-red-50 hover:text-red-600"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>

        <div className="mt-auto border-t border-[#eceeef] p-3">
          <Link
            href="/corpus"
            className="mb-2 block rounded-lg px-2 py-1.5 text-center text-[12px] font-medium text-[#4f46e5] hover:bg-[#eef2ff]"
          >
            语料导入
          </Link>
          <Link
            href="/me"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-[#6b7280] transition-colors hover:bg-black/[0.04] hover:text-[#374151]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e5e7eb] text-xs font-semibold text-[#374151]">
              {(viewer?.displayName ?? "家").slice(0, 1)}
            </div>
            <span className="min-w-0 flex-1 truncate">
              <span className="block truncate font-medium text-[#374151]">
                {viewer?.displayName ?? "家庭成员"}
              </span>
              <span className="block truncate text-[11px] text-[#9ca3af]">
                {(viewer?.isAdmin ? "管理员 · " : "") +
                  (viewer?.canManageMembers ? "成员管理 · " : "")}
                {viewer?.username ? `@${viewer.username}` : "@local"}
              </span>
            </span>
          </Link>
          {viewer?.canManageMembers ? (
            <Link
              href="/admin/users"
              className="mt-2 block rounded-lg px-2 py-1.5 text-center text-[12px] font-medium text-[#4f46e5] hover:bg-[#eef2ff]"
            >
              审核成员
            </Link>
          ) : null}
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col bg-white shadow-[inset_1px_0_0_rgba(0,0,0,0.04)]">
        <header className="relative flex h-14 shrink-0 items-center border-b border-[#f0f0f0] px-4">
          <div className="relative z-10 flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="rounded-lg p-2 text-[#6b7280] hover:bg-black/[0.04] hover:text-[#374151]"
              aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
            >
              <IconSidebarToggle />
            </button>
            <button
              type="button"
              onClick={startNewChat}
              className="rounded-lg p-2 text-[#6b7280] hover:bg-black/[0.04]"
              aria-label="新对话"
            >
              <IconPlus />
            </button>
          </div>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-28 sm:px-36">
            <span className="flex max-w-full min-w-0 items-center justify-center gap-1">
              {activeConversation?.pinned ? (
                <span
                  className="pointer-events-auto shrink-0 text-amber-500"
                  title="已置顶"
                >
                  <IconPin active className="inline align-[-3px]" />
                </span>
              ) : null}
              <span
                className="truncate text-center text-[15px] font-semibold text-[#111827]"
                title={
                  activeTitleRaw !== activeTitleShort
                    ? activeTitleRaw
                    : undefined
                }
              >
                {activeTitleShort}
              </span>
              {activeConversationId ? (
                <button
                  type="button"
                  aria-label="修改标题"
                  className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#9ca3af] hover:bg-black/[0.06] hover:text-[#4f46e5]"
                  onClick={() => {
                    if (!activeConversationId) return;
                    setEditingSidebarId(activeConversationId);
                    setEditSidebarTitleDraft(activeTitleRaw);
                  }}
                >
                  <IconEditTitle className="pt-0.5" />
                </button>
              ) : null}
            </span>
            <span className="hidden text-[11px] text-[#9ca3af] sm:block">
              内容由 AI 生成，请仔细甄别
            </span>
          </div>

          <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1 text-[#9ca3af]">
            <button
              type="button"
              onClick={() => setLogPanelOpen((v) => !v)}
              disabled={!activeConversationId}
              className={[
                "rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40",
                logPanelOpen
                  ? "bg-[#eef2ff] text-[#4f46e5]"
                  : "text-[#6b7280] hover:bg-black/[0.04] hover:text-[#374151]",
              ].join(" ")}
              title="查看当前对话运行日志"
            >
              日志
            </button>
          </div>
        </header>

        <ConversationLogPanel
          open={logPanelOpen && activeConversationId != null}
          onClose={() => setLogPanelOpen(false)}
          conversationTitle={activeTitleRaw}
          bundle={activeLogBundle}
          liveTurnId={streamingTurnId}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          {sendingFirstOnNewChat ? (
            <div className="flex flex-1 items-center justify-center px-6 pb-[18vh] text-[14px] text-[#9ca3af]">
              正在写入会话并调用模型…
            </div>
          ) : showingEmptyLanding ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[18vh]">
              <h1 className="text-center text-[26px] font-semibold tracking-tight text-[#111827] sm:text-[30px]">
                有什么我能帮你的吗？
              </h1>
              <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 text-left text-[14px] leading-snug text-[#374151] transition-colors hover:border-[#d1d5db] hover:bg-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : messagesLoading && messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-[14px] text-[#9ca3af]">
              加载消息中…
            </div>
          ) : messagesError && messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-[14px] text-red-600">
              <span>{messagesError}</span>
              <button
                type="button"
                onClick={() => setMessagesRetryTick((n) => n + 1)}
                className="text-[13px] font-medium text-[#4f46e5] hover:underline"
              >
                重试
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[18vh]">
              <h1 className="text-center text-[26px] font-semibold tracking-tight text-[#111827] sm:text-[30px]">
                有什么我能帮你的吗？
              </h1>
              <p className="mt-2 text-[14px] text-[#9ca3af]">该会话暂无消息</p>
            </div>
          ) : (
            <div
              ref={messagesScrollRef}
              className="flex-1 overflow-y-auto px-4 py-6 sm:px-8"
            >
              <ul className="mx-auto flex max-w-3xl flex-col gap-4">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={[
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "group relative max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap",
                        m.role === "user"
                          ? "bg-[#4f46e5] text-white"
                          : "bg-[#f3f4f6] text-[#111827]",
                      ].join(" ")}
                    >
                      {m.role === "assistant" ? (
                        <AssistantMessageContent
                          content={m.content}
                          blocks={m.blocks}
                          onAction={handleChatAction}
                          staleActionKeys={staleActionKeys}
                          messageId={m.id}
                          messageCreatedAt={m.createdAt ?? null}
                          actionsLocked={
                            turnInFlight ||
                            hasLiveStreamUi ||
                            m.id !== latestAssistantMessageId
                          }
                        />
                      ) : editingMessageId === m.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={3}
                            className="w-full min-w-[240px] resize-y rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-[14px] text-white outline-none placeholder:text-white/50"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEditUserMessage}
                              disabled={sendBusy}
                              className="rounded-full px-3 py-1 text-[12px] text-white/80 hover:bg-white/10"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={() => void commitEditUserMessage()}
                              disabled={
                                !editDraft.trim() ||
                                editDraft.trim() === m.content.trim() ||
                                (sendBusy && !streamingTurnId)
                              }
                              className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#4f46e5] disabled:opacity-40"
                            >
                              保存并重问
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <LinkifiedText text={m.content} />
                          {canEditUserMessage(m) ? (
                            <button
                              type="button"
                              onClick={() => beginEditUserMessage(m)}
                              disabled={sendBusy && !streamingTurnId}
                              className="mt-2 block text-[11px] text-white/70 underline-offset-2 hover:text-white hover:underline disabled:opacity-40"
                            >
                              编辑
                            </button>
                          ) : null}
                        </>
                      )}
                      {m.role === "assistant" && m.timing ? (
                        <MessageTimingLine timing={m.timing} />
                      ) : null}
                      {m.role === "assistant" ? (
                        <MessageCitations citations={m.citations} />
                      ) : null}
                      {m.role === "assistant" && activeConversationId ? (
                        <MessageRetrievalFeedback
                          messageId={m.id}
                          conversationId={activeConversationId}
                          retrievalPaths={m.retrievalPaths}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
                {showAssistantPending ? <AssistantPendingRow /> : null}
                {(sendBusy || streamingTurnId != null) &&
                thinkingPanelVisible &&
                streamThinking.trim() ? (
                  <li className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-[15px] leading-relaxed shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                        思考过程
                      </div>
                      <pre className="mt-2 max-h-[min(40vh,320px)] overflow-y-auto whitespace-pre-wrap text-[13px] text-amber-950/90">
                        {streamThinking}
                      </pre>
                    </div>
                  </li>
                ) : null}
                {streamAnswerPreview || streamBlocks.length > 0 ? (
                  <li className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5 text-[15px] leading-relaxed text-[#374151] whitespace-pre-wrap">
                      <AssistantMessageContent
                        content={streamAnswerPreview}
                        blocks={streamBlocks}
                        onAction={handleChatAction}
                        staleActionKeys={staleActionKeys}
                        actionsLocked={turnInFlight}
                      />
                    </div>
                  </li>
                ) : null}
              </ul>
            </div>
          )}

          <div className="shrink-0 border-t border-[#f3f4f6] bg-white px-4 pb-6 pt-4 sm:px-8">
            <div className="mx-auto max-w-3xl rounded-[22px] border border-[#e8e8e8] bg-[#fafafa] shadow-sm">
              {sendError ? (
                <div className="border-b border-red-100 px-4 py-2 text-[13px] text-red-600">
                  {sendError}
                </div>
              ) : null}
              {uploadNotice ? (
                <div
                  className={[
                    "border-b px-4 py-2 text-[13px]",
                    uploadNotice.includes("失败") ||
                    uploadNotice.startsWith("请")
                      ? "border-red-100 text-red-600"
                      : "border-emerald-100 text-emerald-800",
                  ].join(" ")}
                >
                  {uploadNotice}
                </div>
              ) : null}
              {speech.error ? (
                <div className="border-b border-amber-100 px-4 py-2 text-[13px] text-amber-800">
                  {speech.error}
                </div>
              ) : null}
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  speechDraftBaseRef.current = e.target.value;
                  if (sendError) setSendError(null);
                }}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onCompositionEnd={() => {
                  isComposingRef.current = false;
                }}
                disabled={sendBusy}
                placeholder={
                  sendBusy
                    ? "生成回复中…"
                    : speech.listening
                      ? "正在听你说…（说完点红色麦克风停止）"
                      : pendingAttachments.length > 0
                        ? "写明要对附件做什么：抽取原文 / 总结 / 翻译 / 入库（须有文字才能发送）"
                        : "发消息或输入 '/' 选择技能（Enter 发送，Shift+Enter 换行；中文选字时 Enter 不会发送）"
                }
                rows={3}
                className="block w-full resize-none bg-transparent px-4 pb-2 pt-3 text-[15px] text-[#111827] outline-none placeholder:text-[#a1a1aa] disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey) return;
                  if (e.nativeEvent.isComposing || isComposingRef.current)
                    return;
                  e.preventDefault();
                  void sendMessage();
                }}
              />
              {pendingAttachments.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5 border-t border-black/[0.04] px-3 pt-2">
                  {pendingAttachments.map((a) => (
                    <li
                      key={a.id}
                      className="flex max-w-full items-center gap-1 rounded-full bg-[#eef2ff] px-2.5 py-1 text-[12px] text-[#3730a3]"
                    >
                      <span className="truncate" title={a.name}>
                        {a.name}
                      </span>
                      <button
                        type="button"
                        disabled={sendBusy || uploadBusy}
                        onClick={() => removePendingAttachment(a.id)}
                        className="shrink-0 rounded-full px-1 text-[#6366f1] hover:bg-white/60 disabled:opacity-40"
                        aria-label={`移除 ${a.name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex items-center gap-2 border-t border-black/[0.04] px-3 py-2">
                <input
                  ref={attachInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff,.tif"
                  onChange={(e) => {
                    handleAttachPick(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={uploadBusy || sendBusy}
                  onClick={() => attachInputRef.current?.click()}
                  className="rounded-lg p-2 text-[#9ca3af] hover:bg-black/[0.04] hover:text-[#374151] disabled:opacity-40"
                  aria-label="添加附件"
                  title="添加附件（发送后按你的说明抽取/总结/翻译/入库；语料页仍可直接入库）"
                >
                  <IconPlus className="h-5 w-5" />
                </button>
                <div className="flex-1" />
                {streamingTurnId ? (
                  <button
                    type="button"
                    onClick={() => void stopActiveTurn("cancelled")}
                    className="rounded-full bg-[#dc2626] px-4 py-1.5 text-[13px] font-medium text-white"
                  >
                    停止
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={
                    !draft.trim() ||
                    uploadBusy ||
                    (sendBusy && !streamingTurnId)
                  }
                  className="rounded-full bg-[#4f46e5] px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
                  title={
                    !draft.trim()
                      ? "请先写明要对附件或问题做什么"
                      : undefined
                  }
                >
                  {uploadBusy
                    ? "抽取中…"
                    : sendBusy && !streamingTurnId
                      ? "发送中…"
                      : "发送"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!speech.listening) speechDraftBaseRef.current = draft;
                    speech.toggle();
                  }}
                  disabled={sendBusy || !speech.supported}
                  title={
                    speech.supported
                      ? speech.listening
                        ? "点击停止语音输入"
                        : "语音输入（浏览器识别）"
                      : "当前浏览器不支持语音输入"
                  }
                  className={[
                    "rounded-lg p-2 disabled:opacity-40",
                    speech.listening
                      ? "bg-red-50 text-red-600 animate-pulse"
                      : "text-[#9ca3af] hover:bg-black/[0.04] hover:text-[#374151]",
                  ].join(" ")}
                  aria-label={speech.listening ? "停止语音输入" : "语音输入"}
                  aria-pressed={speech.listening}
                >
                  <IconMic />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
