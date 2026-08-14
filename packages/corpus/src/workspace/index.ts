export type {
    MaterializeResult,
    PurgeResult,
    VaultWorkspaceEntry,
    VaultWorkspaceEntryKind,
} from "./interface";
export {
    createVaultWorkspaceFolder,
    createVaultWorkspaceTxt,
    deleteVaultWorkspaceFolder,
    deleteVaultWorkspaceTxt,
    ensureVaultWorkspaceRoot,
    listVaultWorkspaceDir,
    readVaultWorkspaceTxt,
    renameVaultWorkspaceEntry,
    writeVaultWorkspaceTxt,
} from "./workspace-fs";
export {
    materializeWorkspaceTxt,
    materializeWorkspaceTxtToMarkdown,
    purgeWorkspaceMaterialized,
    purgeWorkspaceTxtCascade,
    readMaterializedMd,
} from "./workspace-materialize";
export {
    CORPUS_WORKSPACE_IMPORTS_REL,
    VAULT_WORKSPACE_DIR,
    getVaultWorkspaceRoot,
    isSafeWorkspaceSegment,
    isWorkspaceTxtName,
    normalizeWorkspaceRel,
    resolveVaultWorkspaceAbsPath,
    workspaceTxtToCorpusMdAbsPath,
    workspaceTxtToCorpusMdRepoPath,
} from "./workspace-paths";
