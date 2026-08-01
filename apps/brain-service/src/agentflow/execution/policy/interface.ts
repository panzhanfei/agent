/** 次数 + 时间；初值统一，按 executor 分档留待后续 */
export type RetryPolicy = {
  maxAttempts: number;
  deadlineMs: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 2,
  deadlineMs: 60_000,
};
