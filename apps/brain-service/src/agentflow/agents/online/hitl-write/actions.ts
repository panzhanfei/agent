/**
 * HITL UI 按钮：exact-match prompt（与列举按钮同一模式，非口语词表）。
 * 用户气泡应展示 label/displayText，不展示 prompt 原文。
 */
export const CORPUS_EDIT_ACTION = {
  openDetailPrefix: "__FAMBRAIN_CORPUS_EDIT_DETAIL__:",
  approvePrefix: "__FAMBRAIN_CORPUS_EDIT_APPROVE__:",
  rejectPrefix: "__FAMBRAIN_CORPUS_EDIT_REJECT__:",
  /** 打开双模式编辑器（path） */
  openFilePrefix: "__FAMBRAIN_CORPUS_EDIT_OPEN__:",
  /** 暂不编辑 / 完成：结束「是否编辑」会话态 */
  dismissEditPrefix: "__FAMBRAIN_CORPUS_EDIT_DISMISS_EDIT__:",
} as const;

export const corpusEditDetailPrompt = (proposalId: string): string =>
  `${CORPUS_EDIT_ACTION.openDetailPrefix}${proposalId}`;

export const corpusEditApprovePrompt = (proposalId: string): string =>
  `${CORPUS_EDIT_ACTION.approvePrefix}${proposalId}`;

export const corpusEditRejectPrompt = (proposalId: string): string =>
  `${CORPUS_EDIT_ACTION.rejectPrefix}${proposalId}`;

export const corpusEditOpenFilePrompt = (targetPath: string): string =>
  `${CORPUS_EDIT_ACTION.openFilePrefix}${targetPath}`;

export const corpusEditDismissEditPrompt = (targetPath: string): string =>
  `${CORPUS_EDIT_ACTION.dismissEditPrefix}${targetPath}`;

export type CorpusEditUiAction =
  | { type: "detail"; proposalId: string }
  | { type: "approve"; proposalId: string }
  | { type: "reject"; proposalId: string }
  | { type: "open"; targetPath: string }
  | { type: "dismiss_edit"; targetPath: string };

export const matchCorpusEditUiPrompt = (
  userQuestion: string
): CorpusEditUiAction | null => {
  const t = userQuestion.trim();
  if (!t) return null;
  if (t.startsWith(CORPUS_EDIT_ACTION.openDetailPrefix)) {
    const proposalId = t.slice(CORPUS_EDIT_ACTION.openDetailPrefix.length).trim();
    return proposalId ? { type: "detail", proposalId } : null;
  }
  if (t.startsWith(CORPUS_EDIT_ACTION.approvePrefix)) {
    const proposalId = t.slice(CORPUS_EDIT_ACTION.approvePrefix.length).trim();
    return proposalId ? { type: "approve", proposalId } : null;
  }
  if (t.startsWith(CORPUS_EDIT_ACTION.rejectPrefix)) {
    const proposalId = t.slice(CORPUS_EDIT_ACTION.rejectPrefix.length).trim();
    return proposalId ? { type: "reject", proposalId } : null;
  }
  if (t.startsWith(CORPUS_EDIT_ACTION.openFilePrefix)) {
    const targetPath = t.slice(CORPUS_EDIT_ACTION.openFilePrefix.length).trim();
    return targetPath ? { type: "open", targetPath } : null;
  }
  if (t.startsWith(CORPUS_EDIT_ACTION.dismissEditPrefix)) {
    const targetPath = t
      .slice(CORPUS_EDIT_ACTION.dismissEditPrefix.length)
      .trim();
    return targetPath ? { type: "dismiss_edit", targetPath } : null;
  }
  return null;
};

/** 从 prompt 提取用于作废同组按钮的 key（proposalId 或 path） */
export const corpusEditStaleGroupKey = (prompt: string): string | null => {
  const action = matchCorpusEditUiPrompt(prompt);
  if (!action) return null;
  if (
    action.type === "detail" ||
    action.type === "approve" ||
    action.type === "reject"
  ) {
    return `proposal:${action.proposalId}`;
  }
  return `path:${action.targetPath}`;
};
