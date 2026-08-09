/**
 * BFF 进行中 turn：cancel API 与 SSE 流共享 preview / AbortController。
 * 注意：浏览器刷新 / SSE 断线 ≠ cancel；仅显式停止会 abort Brain。
 */
import type {
  PipelineLogEntry,
  PipelineTiming,
  TurnAbortReason,
  TurnStepEvent,
} from "@fambrain/brain-types";

export const USER_PAUSED_SUFFIX = "\n\n——用户已暂停";

export type InflightTurn = {
  turnId: string;
  conversationId: string;
  userId: string;
  userMessageId: string | null;
  userQuestion: string;
  preview: string;
  brainAbort: AbortController;
  /** cancel 路径已落库 / 已收尾，stream 结束时勿重复写 */
  finalized: boolean;
  reason: TurnAbortReason | null;
  logs: PipelineLogEntry[];
  steps: TurnStepEvent[];
  timing: PipelineTiming | null;
};

const inflight = new Map<string, InflightTurn>();

export const registerInflightTurn = (input: {
  turnId: string;
  conversationId: string;
  userId: string;
  userQuestion: string;
}): InflightTurn => {
  const existing = inflight.get(input.turnId);
  if (existing) return existing;
  const entry: InflightTurn = {
    turnId: input.turnId,
    conversationId: input.conversationId,
    userId: input.userId,
    userMessageId: null,
    userQuestion: input.userQuestion,
    preview: "",
    brainAbort: new AbortController(),
    finalized: false,
    reason: null,
    logs: [],
    steps: [],
    timing: null,
  };
  inflight.set(input.turnId, entry);
  return entry;
};

export const getInflightTurn = (turnId: string): InflightTurn | undefined =>
  inflight.get(turnId);

export const unregisterInflightTurn = (turnId: string): void => {
  inflight.delete(turnId);
};

export const appendInflightPreview = (
  turnId: string,
  text: string
): void => {
  const entry = inflight.get(turnId);
  if (!entry || entry.finalized) return;
  entry.preview = text;
};

export const buildCancelledAssistantContent = (preview: string): string | null => {
  const trimmed = preview.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith("用户已暂停")) return trimmed;
  return `${trimmed}${USER_PAUSED_SUFFIX}`;
};
