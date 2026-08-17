export type VaultWsUiAction =
  | { type: "list"; folderRel: string }
  | { type: "open"; fileRel: string }
  | { type: "create_file"; folderRel: string }
  | { type: "create_folder"; folderRel: string }
  | { type: "delete_file"; fileRel: string }
  | { type: "delete_folder"; folderRel: string };
