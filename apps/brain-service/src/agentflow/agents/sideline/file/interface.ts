/**
 * 文件子线契约：独立 compiled graph + 独立 thread。
 * 主图只出信封；runtime 建 FileJob 后再跑本图。
 */
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import type { VaultWorkspaceParams } from "./vault";

/** 与 Web 按钮 TTL 对齐；过期则 cancelled + discard 文件 thread */
export const FILE_JOB_TTL_MS = 30 * 60 * 1000;

export type FileAgentTask = "workspace" | "save_offer";

export type FileAgentEnvelope = {
  task: FileAgentTask;
  draft: string;
  attachmentAction: "extract" | "summarize" | "translate" | null;
  composeMode: "qa" | "composite" | "summarize" | null;
  intent: string | null;
  hasPathSteps: boolean;
  hasSearchQuery: boolean;
  language: "zh" | "en";
  workspaceOp?: VaultWorkspaceParams;
};

export type FileAgentAction =
  | "noop"
  | "saved"
  | "cancelled"
  | "workspace_done"
  | "error";

export type FileAgentResult = {
  action: FileAgentAction;
  answer: string;
  savedPath?: string;
};

export type FileHandoffState = {
  envelope: FileAgentEnvelope;
};

export type FileGraphPauseValue = {
  kind: "vault_wait";
  answer: string;
  blocks: AssistantMessageBlock[];
};
