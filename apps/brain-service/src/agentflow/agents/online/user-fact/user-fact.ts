import type { AssistantMessageBlock, DbChatTurn } from "@fambrain/brain-types";
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract/prompt";

/** 编排器 user_fact 分支路由（来自 Intake JSON，非问句 regex） */
export type UserFactRoute = {
  action: "remember" | "recall";
  /** 稳定键：Intake 产出开集 slug */
  factKey: string;
  /** 面向用户的字段名：由 Intake userFactLabel 提供 */
  label: string;
  value?: string;
};

/** Mem0 持久化结构（metadata + 可解析正文） */
export type UserFactRecord = {
  type: "user_fact";
  factKey: string;
  label: string;
  value: string;
};

export const normalizeFactKey = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_+-]/g, "")
    .slice(0, 64);

export const serializeUserFactRecord = (
  input: Omit<UserFactRecord, "type">
): string =>
  JSON.stringify({
    type: "user_fact",
    factKey: input.factKey,
    label: input.label,
    value: input.value,
  });

export const parseUserFactRecord = (text: string): UserFactRecord | null => {
  const t = text.trim();
  if (!t.startsWith("{")) return null;
  try {
    const o = JSON.parse(t) as Partial<UserFactRecord>;
    if (
      o.type === "user_fact" &&
      typeof o.factKey === "string" &&
      typeof o.label === "string" &&
      typeof o.value === "string" &&
      o.factKey.trim() &&
      o.value.trim()
    ) {
      return {
        type: "user_fact",
        factKey: o.factKey.trim(),
        label: o.label.trim(),
        value: o.value.trim(),
      };
    }
  } catch {
    /* 非 JSON 记忆行 */
  }
  return null;
};

/** 通用长度校验（无 factKey 格式表） */
export const validateFactValue = (value: string): string | null => {
  const v = value.trim();
  if (v.length < 1 || v.length > 200) return null;
  return v;
};

/**
 * @deprecated 无字段名格式表；等价 validateFactValue。
 * 保留导出以免外部脚本断链。
 */
export const validateFactValueForKey = (
  _factKey: string,
  value: string
): string | null => validateFactValue(value);

/** 解析 Mem0 存储行「…：value（字段 factKey）」 */
const extractFromFieldMarker = (
  text: string,
  factKey: string
): string | null => {
  if (!new RegExp(`（字段\\s+${factKey}）`, "iu").test(text)) return null;
  const colon = text.match(/[:：]\s*([^（(，,。！？；;\s]+)/u);
  if (colon?.[1]) {
    return validateFactValue(colon[1].trim());
  }
  return null;
};

/** Intake intent 是否为跨会话用户自述记忆（remember / recall） */
export const isUserFactIntent = (
  intent: IntakeRoutingDecision["intent"]
): boolean => intent === "remember_user_fact" || intent === "recall_user_fact";

/** Intake 结构化 intent → userFact 路由（主路径） */
export const routeUserFactFromIntake = (
  decision: IntakeRoutingDecision
): UserFactRoute | null => {
  if (decision.intent === "remember_user_fact") {
    const factKey = normalizeFactKey(decision.userFactKey ?? "");
    if (!factKey) return null;
    const label = decision.userFactLabel?.trim() || factKey;
    const value = decision.userFactValue?.trim();
    return {
      action: "remember",
      factKey,
      label,
      ...(value ? { value } : {}),
    };
  }
  if (decision.intent === "recall_user_fact") {
    const factKey = normalizeFactKey(decision.userFactKey ?? "");
    if (!factKey) return null;
    const label = decision.userFactLabel?.trim() || factKey;
    return { action: "recall", factKey, label };
  }
  return null;
};

/**
 * 同轮 remember side-effect：retrieve_and_answer 且已填 userFactKey+Value。
 * 供 plan-fanout 并行 userFactSide；不改变纯 remember/recall 早退路径。
 */
export const routeUserFactSideEffect = (
  decision: IntakeRoutingDecision
): UserFactRoute | null => {
  if (decision.intent !== "retrieve_and_answer") return null;
  const factKey = normalizeFactKey(decision.userFactKey ?? "");
  if (!factKey) return null;
  const value = decision.userFactValue?.trim();
  if (!value) return null;
  const label = decision.userFactLabel?.trim() || factKey;
  return { action: "remember", factKey, label, value };
};

export const findUserFactValueInTexts = (
  texts: string[],
  factKey: string,
  label?: string
): string | null => {
  const key = factKey.trim();
  if (key) {
    for (const line of texts) {
      const rec = parseUserFactRecord(line);
      if (rec && rec.factKey === key) {
        const v = validateFactValue(rec.value);
        if (v) return v;
      }
    }
    for (const line of texts) {
      const byMarker = extractFromFieldMarker(line, key);
      if (byMarker) return byMarker;
    }
  }
  if (label?.trim()) {
    for (const line of texts) {
      const v =
        extractLooseValueAfterLabel(line, label) ??
        (key ? extractLooseValueAfterLabel(line, key) : null);
      if (v) return v;
    }
  } else if (key) {
    for (const line of texts) {
      const v = extractLooseValueAfterLabel(line, key);
      if (v) return v;
    }
  }
  return null;
};

export const findUserFactValueInMemoryBlock = (
  memoryBlock: string | null | undefined,
  factKey: string,
  label?: string
): string | null => {
  if (!memoryBlock?.trim()) return null;
  const lines = memoryBlock
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  return findUserFactValueInTexts(lines, factKey, label);
};

export const memoryBlockHasStructuredUserFacts = (
  memoryBlock: string | null | undefined
): boolean => {
  if (!memoryBlock?.trim()) return false;
  return (
    memoryBlock.includes('"type":"user_fact"') ||
    /（字段\s+[a-z0-9_+-]+）/iu.test(memoryBlock)
  );
};

/**
 * remember 时 Intake 未带 value：按 Intake 提供的 label / factKey 松散抽取（无字段名口语表）。
 */
export const coalesceRememberValue = (
  route: UserFactRoute,
  userQuestion: string,
  history: DbChatTurn[]
): string | null => {
  if (route.value) {
    return validateFactValue(route.value);
  }
  const fromQuestion =
    extractLooseValueAfterLabel(userQuestion, route.label) ??
    extractLooseValueAfterLabel(userQuestion, route.factKey);
  if (fromQuestion) return fromQuestion;
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i]!;
    if (turn.role !== "user") continue;
    const v =
      extractLooseValueAfterLabel(turn.content, route.label) ??
      extractLooseValueAfterLabel(turn.content, route.factKey);
    if (v) return v;
  }
  return null;
};

/** 「Intake label + ：/是/为 + 值」；不按 factKey 分支 */
const extractLooseValueAfterLabel = (
  text: string,
  label: string
): string | null => {
  const q = text.trim();
  if (!q || !label.trim()) return null;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const valueToken = `([^\\s，,。！？；;（）]+)`;
  const patterns = [
    new RegExp(`${escaped}\\s*[:：]\\s*${valueToken}`, "iu"),
    new RegExp(`${escaped}\\s*(?:是|为)\\s*${valueToken}`, "iu"),
    new RegExp(
      `(?:是|为)\\s*${valueToken}\\s*[,，]?\\s*${escaped}`,
      "iu"
    ),
  ];
  for (const re of patterns) {
    const m = q.match(re);
    if (m?.[1]?.trim()) {
      const raw = m[1].trim();
      // 松散抽取至少 2 字符，避免单字误切
      if (raw.length < 2) continue;
      return validateFactValue(raw);
    }
  }
  return null;
};

export const buildRememberConfirmAnswer = (
  label: string,
  value: string,
  language: "zh" | "en" | "mixed"
): string =>
  language === "en"
    ? `Got it — I've saved your ${label}: ${value}.`
    : `好的，已记住您的${label}：${value}。`;

/** 同轮 remember side-effect → 助手 blocks 首段（composite 有 blocks 时 UI 只渲染 blocks） */
export const sideEffectAnswerToAssistantBlock = (
  sideEffectAnswer: string | null | undefined
): AssistantMessageBlock | null => {
  const markdown = sideEffectAnswer?.trim();
  if (!markdown) return null;
  return { type: "text", markdown };
};

export const prependSideEffectAssistantBlocks = (
  sideEffectAnswer: string | null | undefined,
  blocks: AssistantMessageBlock[]
): AssistantMessageBlock[] => {
  const head = sideEffectAnswerToAssistantBlock(sideEffectAnswer);
  return head ? [head, ...blocks] : blocks;
};

export const buildRememberMissingValueAnswer = (
  label: string,
  language: "zh" | "en" | "mixed"
): string =>
  language === "en"
    ? `Please tell me your ${label} so I can save it.`
    : `请告诉我您的${label}，我再帮您记住。`;

export const buildRecallAnswer = (
  label: string,
  value: string,
  language: "zh" | "en" | "mixed"
): string =>
  language === "en"
    ? `Your ${label} on record is ${value}.`
    : `您记录的${label}是 ${value}。`;

export const buildRecallMissingAnswer = (
  label: string,
  language: "zh" | "en" | "mixed"
): string =>
  language === "en"
    ? `I don't have your ${label} saved yet. You can say e.g. "Remember my ${label} is …".`
    : `尚未记录您的${label}。您可以说「我的${label}是……，请帮我记住」。`;
