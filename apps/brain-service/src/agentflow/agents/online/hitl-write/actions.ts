/**
 * HITL UI 按钮：exact-match prompt（与列举按钮同一模式，非口语词表）。
 * prompt 携带 proposalId，供 resume API / Intake 旁路识别。
 */
export const CORPUS_EDIT_ACTION = {
  openDetailPrefix: "__FAMBRAIN_CORPUS_EDIT_DETAIL__:",
  approvePrefix: "__FAMBRAIN_CORPUS_EDIT_APPROVE__:",
  rejectPrefix: "__FAMBRAIN_CORPUS_EDIT_REJECT__:",
} as const;

export const corpusEditDetailPrompt = (proposalId: string): string =>
  `${CORPUS_EDIT_ACTION.openDetailPrefix}${proposalId}`;

export const corpusEditApprovePrompt = (proposalId: string): string =>
  `${CORPUS_EDIT_ACTION.approvePrefix}${proposalId}`;

export const corpusEditRejectPrompt = (proposalId: string): string =>
  `${CORPUS_EDIT_ACTION.rejectPrefix}${proposalId}`;

export type CorpusEditUiAction =
  | { type: "detail"; proposalId: string }
  | { type: "approve"; proposalId: string }
  | { type: "reject"; proposalId: string };

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
  return null;
};
