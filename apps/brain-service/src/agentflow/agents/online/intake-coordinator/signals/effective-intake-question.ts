/**
 * Intake 进线：normalize → 单字短路。
 * 指代：单次 Understand+Plan；上轮实质问作结构化上下文字段喂入。
 * **已废除** Plan 级「unresolved → 拼接再调 Intake」。
 */
import type { DbChatTurn } from "@fambrain/brain-types";
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import {
  historySupportsContinuation,
  lastSubstantiveUserQuestion,
} from "./query-signals";

/** 单码点附和（长度已是 1）；不进检索 */
const ACK_SINGLE = new Set([
  "好",
  "嗯",
  "哦",
  "噢",
  "啊",
  "嘿",
  "哈",
  "行",
  "哟",
  "唉",
  "咦",
  "喔",
]);

/** Unicode 码点数（BMP 汉字/标点为 1） */
export const utteranceCodePointLength = (question: string): number =>
  Array.from(question.trim()).length;

/**
 * 进线轻量规范化：trim + 压掉连续相同**标点/空白/汉字**（呢呢呢？？？→呢？；好好好→好）。
 * **不**压缩拉丁字母/数字（避免 qq→q、11→1）。
 * 不做 NFKC（避免全角「？」变半角「?」导致与 history 对不上）。
 * 用于省 token / 单字判定；不做语义去重或相似句合并。
 */
export const normalizeIntakeUtterance = (question: string): string => {
  const t = question.trim();
  if (!t) return t;
  const out: string[] = [];
  for (const ch of Array.from(t)) {
    const prev = out[out.length - 1];
    // 字母数字保留重复（qq / email 局部）；其余重复码点压成 1
    if (prev === ch && !/[a-zA-Z0-9]/.test(ch)) continue;
    out.push(ch);
  }
  return out.join("");
};

/**
 * 去掉首尾标点/符号后的实质串，供「是否单字」判定（「呢？？」→「呢」）。
 * 全是标点时返回空串。
 */
export const substantiveUtteranceForSingleChar = (
  normalized: string
): string => {
  const t = normalized.trim();
  if (!t) return "";
  return t.replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "");
};

/** normalize 后再取单字判定用的表面形式 */
export const surfaceForSingleCharSignal = (question: string): string => {
  const normalized = normalizeIntakeUtterance(question);
  const substantive = substantiveUtteranceForSingleChar(normalized);
  if (substantive) return substantive;
  return normalized;
};

export const isSingleCodePointUtterance = (question: string): boolean =>
  utteranceCodePointLength(surfaceForSingleCharSignal(question)) === 1;

export const isAckLikeSingleChar = (question: string): boolean => {
  const t = surfaceForSingleCharSignal(question);
  return utteranceCodePointLength(t) === 1 && ACK_SINGLE.has(t);
};

/**
 * 单字且不应调 Intake LLM（先 normalize 再判）：
 * - 附和（好/嗯/…，含「好好好」「嗯！！！」）
 * - 或无可续上文 / 无上轮实质问
 */
export const shouldShortCircuitIncompleteUtterance = (
  userQuestion: string,
  history: DbChatTurn[]
): boolean => {
  const surface = surfaceForSingleCharSignal(userQuestion);
  if (utteranceCodePointLength(surface) !== 1) return false;
  if (ACK_SINGLE.has(surface)) return true;
  if (!historySupportsContinuation(history)) return true;
  const prior = lastSubstantiveUserQuestion(
    history,
    normalizeIntakeUtterance(userQuestion) || userQuestion
  );
  return !prior;
};

export type CoreferenceMergeRetry = {
  retry: boolean;
  prior: string | null;
  mergedQuestion: string | null;
};

/**
 * @deprecated 阶段 0：废除 Plan 级指代拼接重试；恒不重试。
 * 保留签名供旧 verify/测试迁移；新逻辑见 priorSubstantiveQuestion 输入增强。
 */
export const shouldRetryCoreferenceMerge = (
  _peek: Pick<IntakeRoutingDecision, "coreference"> | null,
  _userQuestion: string,
  _history: DbChatTurn[]
): CoreferenceMergeRetry => ({
  retry: false,
  prior: null,
  mergedQuestion: null,
});

export const buildMergedCoreferenceQuestion = (
  prior: string,
  current: string
): string => `${prior.trim()}；${current.trim()}`;

/** 改写 history 中最后一条 user，供 LLM 看到合并/规范化问句 */
export const rewriteLastUserTurn = (
  history: DbChatTurn[],
  content: string
): DbChatTurn[] => {
  const out = history.map((t) => ({ ...t }));
  for (let i = out.length - 1; i >= 0; i -= 1) {
    if (out[i]?.role === "user") {
      out[i] = { role: "user", content };
      break;
    }
  }
  return out;
};
