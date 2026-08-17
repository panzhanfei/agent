/**
 * 写回闸门：Compose 后一次 interrupt，确认后 create_file + materialize。
 */
import type { AssistantMessageBlock } from "@fambrain/brain-types";

export const VAULT_SAVE_CONFIRM_PROMPT = "__FAMBRAIN_VAULT_SAVE_CONFIRM__";
export const VAULT_SAVE_CANCEL_PROMPT = "__FAMBRAIN_VAULT_SAVE_CANCEL__";

export type VaultSaveResume =
  | { kind: "confirm"; name: string }
  | { kind: "cancel" }
  | { kind: "unknown" };

export type VaultSaveGateBlocks = {
  answer: string;
  blocks: AssistantMessageBlock[];
};
