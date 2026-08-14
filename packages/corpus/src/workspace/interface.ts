export type VaultWorkspaceEntryKind = "file" | "folder";

export type VaultWorkspaceEntry = {
    kind: VaultWorkspaceEntryKind;
    /** 相对 workspace 根，如 `notes` 或 `notes/a.txt`；根级用 "" */
    relativePath: string;
    name: string;
    sizeBytes?: number;
    modifiedAt?: string;
};

export type MaterializeResult = {
    workspaceRel: string;
    mdRepoPath: string;
    mdAbsPath: string;
    indexed: boolean;
    deletedVectors: number;
    upserted: number;
};

export type PurgeResult = {
    workspaceRel: string;
    mdRepoPath: string | null;
    mdDeleted: boolean;
    vectorsDeleted: number;
};
