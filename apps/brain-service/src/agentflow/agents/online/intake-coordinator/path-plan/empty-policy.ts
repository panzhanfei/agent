/**
 * 空证据策略：结构字段，不猜问句。
 * - require：再批后仍空 → 整轮失败/insufficient
 * - omit：空则从回答中省略该步
 * - degrade：带着缺口继续（备注/降级）
 */
import type { EmptyPolicy } from "./interface";

export type { EmptyPolicy };

export const DEFAULT_EMPTY_POLICY: EmptyPolicy = "degrade";

export const legalizeEmptyPolicy = (raw: unknown): EmptyPolicy => {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "require" || v === "omit" || v === "degrade") return v;
  return DEFAULT_EMPTY_POLICY;
};
