/** 与 brain hitl-write/actions 前缀对齐（UI 侧，非口语硬编码） */

export const CORPUS_EDIT_ACTION = {
  openDetailPrefix: "__FAMBRAIN_CORPUS_EDIT_DETAIL__:",
  approvePrefix: "__FAMBRAIN_CORPUS_EDIT_APPROVE__:",
  rejectPrefix: "__FAMBRAIN_CORPUS_EDIT_REJECT__:",
  openFilePrefix: "__FAMBRAIN_CORPUS_EDIT_OPEN__:",
  dismissEditPrefix: "__FAMBRAIN_CORPUS_EDIT_DISMISS_EDIT__:",
} as const;

export type ChatActionPayload = {
  id: string;
  label: string;
  prompt: string;
  displayText?: string;
  disabled?: boolean;
  clientHandler?: "chat" | "open_editor";
};

export const corpusEditStaleGroupKey = (prompt: string): string | null => {
  const t = prompt.trim();
  if (t.startsWith(CORPUS_EDIT_ACTION.openDetailPrefix)) {
    return `proposal:${t.slice(CORPUS_EDIT_ACTION.openDetailPrefix.length).trim()}`;
  }
  if (t.startsWith(CORPUS_EDIT_ACTION.approvePrefix)) {
    return `proposal:${t.slice(CORPUS_EDIT_ACTION.approvePrefix.length).trim()}`;
  }
  if (t.startsWith(CORPUS_EDIT_ACTION.rejectPrefix)) {
    return `proposal:${t.slice(CORPUS_EDIT_ACTION.rejectPrefix.length).trim()}`;
  }
  if (t.startsWith(CORPUS_EDIT_ACTION.openFilePrefix)) {
    return `path:${t.slice(CORPUS_EDIT_ACTION.openFilePrefix.length).trim()}`;
  }
  if (t.startsWith(CORPUS_EDIT_ACTION.dismissEditPrefix)) {
    return `path:${t.slice(CORPUS_EDIT_ACTION.dismissEditPrefix.length).trim()}`;
  }
  return null;
};

export const corpusEditTargetPathFromOpenPrompt = (
  prompt: string
): string | null => {
  const t = prompt.trim();
  if (!t.startsWith(CORPUS_EDIT_ACTION.openFilePrefix)) return null;
  const path = t.slice(CORPUS_EDIT_ACTION.openFilePrefix.length).trim();
  return path || null;
};

export const actionIsStale = (
  prompt: string,
  staleKeys: ReadonlySet<string>
): boolean => {
  const key = corpusEditStaleGroupKey(prompt);
  return key != null && staleKeys.has(key);
};
