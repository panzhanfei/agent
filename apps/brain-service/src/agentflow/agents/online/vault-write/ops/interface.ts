import type { AssistantMessageBlock } from "@fambrain/brain-types";

export type VaultWorkspaceRunResult = {
  ok: boolean;
  answer: string;
  blocks?: AssistantMessageBlock[];
  error?: string;
  syncNote?: string;
};
