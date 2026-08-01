/**
 * 从环境变量加载单槽预算（结构配置，非业务规则）。
 * 非法/缺省 → legalizeRetryPolicy 统一初值。
 */
import type { RetryPolicy } from "./interface";
import { legalizeRetryPolicy } from "./retry";

const readEnv = (key: string): string | undefined => {
  const v = process.env[key];
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
};

/** SLOT_MAX_ATTEMPTS + SLOT_DEADLINE_MS → RetryPolicy */
export const loadRetryPolicyFromEnv = (): RetryPolicy => {
  const maxRaw = readEnv("SLOT_MAX_ATTEMPTS");
  const deadlineRaw = readEnv("SLOT_DEADLINE_MS");
  return legalizeRetryPolicy({
    maxAttempts: maxRaw !== undefined ? Number(maxRaw) : undefined,
    deadlineMs: deadlineRaw !== undefined ? Number(deadlineRaw) : undefined,
  });
};

/**
 * SLOT_GLOBAL_REBATCH_ENABLED：Join 后全局 B（结构化补丁再批 ≤1）。
 * 未设 / 空 / 1 / true / yes → 开；仅显式 0 / false / no → 关。
 */
export const isGlobalRebatchEnabledFromEnv = (): boolean => {
  const raw = readEnv("SLOT_GLOBAL_REBATCH_ENABLED");
  if (raw === undefined) return true;
  const s = raw.toLowerCase();
  if (s === "0" || s === "false" || s === "no") return false;
  return true;
};
