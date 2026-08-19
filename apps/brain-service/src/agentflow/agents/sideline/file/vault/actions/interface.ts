export type VaultWsFileAction =
  | { type: "list"; folderRel: string }
  | { type: "open"; fileRel: string }
  | { type: "create_file"; folderRel: string }
  | { type: "create_folder"; folderRel: string }
  | { type: "delete_file"; fileRel: string }
  | { type: "delete_folder"; folderRel: string };

/** 文件操作 + HITL 结束（结束不是 CRUD op） */
export type VaultWsUiAction = VaultWsFileAction | { type: "done" };
