/**
 * vault workspace UI exact-match prompts（非口语词表）。
 */
import type { VaultWsUiAction } from "./interface";

export const VAULT_WORKSPACE_ACTION = {
  listPrefix: "__FAMBRAIN_VAULT_WS_LIST__:",
  openPrefix: "__FAMBRAIN_VAULT_WS_OPEN__:",
  createFilePrefix: "__FAMBRAIN_VAULT_WS_CREATE_FILE__:",
  createFolderPrefix: "__FAMBRAIN_VAULT_WS_CREATE_FOLDER__:",
  deleteFilePrefix: "__FAMBRAIN_VAULT_WS_DELETE_FILE__:",
  deleteFolderPrefix: "__FAMBRAIN_VAULT_WS_DELETE_FOLDER__:",
  /** 入口：打开原文库根 list */
  rootListPrompt: "__FAMBRAIN_VAULT_WS_LIST__:",
  /** HITL 结束：节点 return → persistTurnEnd */
  donePrompt: "__FAMBRAIN_VAULT_WS_DONE__",
} as const;

/** UI 按钮 exact-match（与 ENUMERATION_ACTION_PROMPTS 同类，允许） */
export const VAULT_WORKSPACE_UI_ENTRY = "我的原文库";

export const vaultWsListPrompt = (folderRel = ""): string =>
  `${VAULT_WORKSPACE_ACTION.listPrefix}${folderRel}`;

export const vaultWsOpenPrompt = (fileRel: string): string =>
  `${VAULT_WORKSPACE_ACTION.openPrefix}${fileRel}`;

export const vaultWsCreateFilePrompt = (folderRel: string): string =>
  `${VAULT_WORKSPACE_ACTION.createFilePrefix}${folderRel}`;

export const vaultWsCreateFolderPrompt = (folderRel: string): string =>
  `${VAULT_WORKSPACE_ACTION.createFolderPrefix}${folderRel}`;

export const vaultWsDeleteFilePrompt = (fileRel: string): string =>
  `${VAULT_WORKSPACE_ACTION.deleteFilePrefix}${fileRel}`;

export const vaultWsDeleteFolderPrompt = (folderRel: string): string =>
  `${VAULT_WORKSPACE_ACTION.deleteFolderPrefix}${folderRel}`;

export const vaultWsDonePrompt = (): string => VAULT_WORKSPACE_ACTION.donePrompt;

export const vaultWorkspaceDoneReply = (language?: "zh" | "en"): string =>
  language === "en" ? "Workspace session finished." : "原文库操作已结束。";

export const vaultWsDoneAction = (
  language?: "zh" | "en"
): {
  id: string;
  label: string;
  prompt: string;
  displayText: string;
} => {
  const zh = language !== "en";
  return {
    id: "vault-ws-done",
    label: zh ? "结束" : "Done",
    prompt: VAULT_WORKSPACE_ACTION.donePrompt,
    displayText: zh ? "结束原文库操作" : "Finish workspace",
  };
};

export const matchVaultWorkspaceUiPrompt = (
  userQuestion: string
): VaultWsUiAction | null => {
  const t = userQuestion.trim();
  if (!t) return null;
  if (t === VAULT_WORKSPACE_ACTION.donePrompt) return { type: "done" };
  const take = (prefix: string) => t.slice(prefix.length);
  if (t.startsWith(VAULT_WORKSPACE_ACTION.listPrefix)) {
    return { type: "list", folderRel: take(VAULT_WORKSPACE_ACTION.listPrefix) };
  }
  if (t.startsWith(VAULT_WORKSPACE_ACTION.openPrefix)) {
    const fileRel = take(VAULT_WORKSPACE_ACTION.openPrefix);
    return fileRel ? { type: "open", fileRel } : null;
  }
  if (t.startsWith(VAULT_WORKSPACE_ACTION.createFilePrefix)) {
    return {
      type: "create_file",
      folderRel: take(VAULT_WORKSPACE_ACTION.createFilePrefix),
    };
  }
  if (t.startsWith(VAULT_WORKSPACE_ACTION.createFolderPrefix)) {
    return {
      type: "create_folder",
      folderRel: take(VAULT_WORKSPACE_ACTION.createFolderPrefix),
    };
  }
  if (t.startsWith(VAULT_WORKSPACE_ACTION.deleteFilePrefix)) {
    const fileRel = take(VAULT_WORKSPACE_ACTION.deleteFilePrefix);
    return fileRel ? { type: "delete_file", fileRel } : null;
  }
  if (t.startsWith(VAULT_WORKSPACE_ACTION.deleteFolderPrefix)) {
    const folderRel = take(VAULT_WORKSPACE_ACTION.deleteFolderPrefix);
    return folderRel ? { type: "delete_folder", folderRel } : null;
  }
  return null;
};
