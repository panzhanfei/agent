/** propose / path 错误码 → 面向用户文案（结构错误，非口语猜意图） */

const ZH: Record<string, string> = {
  path_not_allowed:
    "路径不在允许的语料目录内（仅 personal / experience / projects 下的 .md）。",
  file_not_found: "目标文件不存在，无法更新或清空。可先新建该文件。",
  file_already_exists: "文件已存在，无法重复新建。可改为打开或更新。",
  empty_after_content:
    "更新需要提供变更后的正文；若只想查看文件，请使用打开/预览。",
  open_not_writable: "打开/预览不会写入文件。",
  missing_target_path: "缺少结构化文件路径（params.targetPath）。",
  missing_active_slot: "内部错误：缺少 activeSlotId。",
  proposal_not_found: "未找到该语料修订提案，可能已过期。",
  proposal_not_pending: "该提案已处理，无法再次确认或放弃。",
  proposal_expired: "该提案已过期或会话已结束，请重新发起修订。",
};

const EN: Record<string, string> = {
  path_not_allowed:
    "Path is outside allowed corpus folders (personal / experience / projects .md only).",
  file_not_found: "File not found. Create it first, or check the path.",
  file_already_exists: "File already exists. Open or update it instead.",
  empty_after_content:
    "Update requires afterContent. To view only, use open/preview.",
  open_not_writable: "Open/preview does not write files.",
  missing_target_path: "Missing structured targetPath.",
  missing_active_slot: "Internal error: missing activeSlotId.",
  proposal_not_found: "Edit proposal not found or expired.",
  proposal_not_pending: "Proposal is no longer pending.",
  proposal_expired:
    "This proposal expired or the conversation ended. Start a new edit.",
};

export const corpusEditErrorMessage = (
  code: string,
  language: "zh" | "en" = "zh"
): string => {
  const table = language === "en" ? EN : ZH;
  if (table[code]) return table[code]!;
  if (code.startsWith("proposal_status_")) {
    return language === "en"
      ? `Proposal status is ${code.replace("proposal_status_", "")}.`
      : `提案状态为 ${code.replace("proposal_status_", "")}，无法继续。`;
  }
  return language === "en"
    ? `Corpus edit failed (${code}).`
    : `语料修订失败（${code}）。`;
};
