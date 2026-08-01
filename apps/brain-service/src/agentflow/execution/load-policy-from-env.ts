/**
 * 从环境变量加载单槽预算（结构配置，非业务规则）。
 * 非法/缺省 → legalizeRetryPolicy 统一初值。
 */
import { legalizeRetryPolicy } from "./retry-policy";
import type { RetryPolicy } from "./interface";

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
 * SLOT_GLOBAL_REBATCH_ENABLED：阶段 4 才真再批；阶段 1 仅影响是否打「候选」日志。
 * 未设 / 0 / false → 关闭日志候选；1 / true → Join 可打全局 B 候选日志。
 */
export const isGlobalRebatchEnabledFromEnv = (): boolean => {
  const raw = readEnv("SLOT_GLOBAL_REBATCH_ENABLED");
  if (raw === undefined) return false;
  const s = raw.toLowerCase();
  return s === "1" || s === "true" || s === "yes";
};
