/** 公司实体：优先 Intake searchQuery（LLM 已写入），不用口语正则抽 */
export const extractCompanyHint = (
  _userQuestion: string,
  fallback: string
): string => {
  const hint = fallback.trim();
  return hint.length >= 2 ? hint : fallback;
};
