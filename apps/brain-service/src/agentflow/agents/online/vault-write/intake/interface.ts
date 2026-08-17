import type { VaultWorkspaceParams } from "../interface";

export type { VaultWsFileAction, VaultWsUiAction } from "../actions";

/** Resume 下一步：继续 CRUD，或结束走出图 */
export type VaultResumeNext =
  | { kind: "continue"; params: VaultWorkspaceParams }
  | { kind: "done" };
