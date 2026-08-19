import type { VaultWorkspaceParams } from "../vault";

export type { VaultWorkspaceParams, VaultWsFileAction, VaultWsUiAction } from "../vault";

/** Resume 下一步：继续 CRUD，或结束走出图 */
export type VaultResumeNext =
  | { kind: "continue"; params: VaultWorkspaceParams }
  | { kind: "done" };
