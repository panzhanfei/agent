/**
 * 文件子线：独立 compiled graph + 独立 thread。
 * 主图只引 handoff/decide；orchestrator 引 getCompiledFileGraph。
 */
export type {
  FileAgentAction,
  FileAgentEnvelope,
  FileAgentResult,
  FileAgentTask,
  FileGraphPauseValue,
  FileHandoffState,
} from "./interface";
export { FILE_JOB_TTL_MS } from "./interface";

export { shouldRunFileAgent } from "./decide";
export { shouldHandoffFromPipelineState, buildFileEnvelopeFromPipelineState } from "./handoff";
export {
  getCompiledFileGraph,
  resetCompiledFileGraph,
  FileGraphAnnotation,
  type FileGraphState,
} from "./graph";

export {
  parseVaultSaveResume,
  buildVaultSaveGateBlocks,
  sanitizeVaultSaveBasename,
  suggestedVaultSaveBasename,
  VAULT_SAVE_CANCEL_PROMPT,
  VAULT_SAVE_CONFIRM_PROMPT,
} from "./save-hitl";

export {
  buildVaultWorkspaceUiDecision,
  matchVaultWorkspaceUiAction,
  resolveVaultWorkspaceUiBypass,
  toVaultWorkspaceParams,
  nextFromResume,
} from "./workspace";

export {
  VAULT_WORKSPACE_OPS,
  VAULT_WORKSPACE_ACTION,
  VAULT_WORKSPACE_UI_ENTRY,
  parseVaultWorkspaceParams,
  purgeOneForTest,
  rememberVaultWorkspaceOp,
  runVaultWorkspaceOp,
  takeCachedVaultWorkspaceOp,
  matchVaultWorkspaceUiPrompt,
  vaultWorkspaceDoneReply,
  vaultWsCreateFilePrompt,
  vaultWsCreateFolderPrompt,
  vaultWsDeleteFilePrompt,
  vaultWsDeleteFolderPrompt,
  vaultWsDonePrompt,
  vaultWsListPrompt,
  vaultWsOpenPrompt,
  withVaultHitlDone,
  type VaultWorkspaceParams,
  type VaultWorkspaceRunResult,
} from "./vault";
