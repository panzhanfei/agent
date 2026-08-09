/**
 * vault workspace（txt）操作契约。
 */
export const VAULT_WORKSPACE_OPS = [
  "list",
  "open",
  "create_file",
  "create_folder",
  "update",
  "delete_file",
  "delete_folder",
] as const;

export type VaultWorkspaceOp = (typeof VAULT_WORKSPACE_OPS)[number];

export type VaultWorkspaceParams = {
  operation: VaultWorkspaceOp;
  /** 相对 workspace 根；list 时为当前文件夹（""=根） */
  targetPath?: string | null;
  /** create_file / create_folder 的名称 */
  name?: string | null;
  /** update / create_file 正文 */
  afterContent?: string | null;
  /** delete_folder 是否级联 */
  recursive?: boolean;
};

export type VaultWorkspaceListResult = {
  folderRel: string;
  entries: Array<{
    kind: "file" | "folder";
    relativePath: string;
    name: string;
  }>;
  empty: boolean;
};
