/**
 * UI exact-match 旁路：原文库 list / open / create / delete。
 */
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import { matchVaultWorkspaceUiPrompt, VAULT_WORKSPACE_UI_ENTRY } from "./actions";
import { runVaultWorkspaceOp } from "./ops";
import type { VaultWorkspaceParams } from "./interface";

const baseDirect = (briefReply: string): IntakeRoutingDecision => ({
  intent: "direct_answer",
  searchQuery: "",
  subTasks: [],
  topics: [],
  language: "zh",
  confidence: 1,
  queryType: "default",
  clarifyingQuestion: null,
  briefReply,
  retrievalPlan: [],
  userFactKey: null,
  userFactLabel: null,
  userFactValue: null,
});

export type VaultWorkspaceIntakeBypass = {
  decision: IntakeRoutingDecision;
  answer: string;
  assistantBlocks: AssistantMessageBlock[] | null;
};

const toParams = (
  action: NonNullable<ReturnType<typeof matchVaultWorkspaceUiPrompt>>
): VaultWorkspaceParams => {
  switch (action.type) {
    case "list":
      return { operation: "list", targetPath: action.folderRel };
    case "open":
      return { operation: "open", targetPath: action.fileRel };
    case "create_file":
      return {
        operation: "create_file",
        targetPath: action.folderRel,
        name: `untitled-${Date.now().toString(36)}.txt`,
        afterContent: "",
      };
    case "create_folder":
      return {
        operation: "create_folder",
        targetPath: action.folderRel,
        name: `folder-${Date.now().toString(36)}`,
      };
    case "delete_file":
      return { operation: "delete_file", targetPath: action.fileRel };
    case "delete_folder":
      return {
        operation: "delete_folder",
        targetPath: action.folderRel,
        recursive: true,
      };
  }
};

export const resolveVaultWorkspaceUiBypass = async (input: {
  userQuestion: string;
  corpusUserId: string;
  language?: "zh" | "en";
}): Promise<VaultWorkspaceIntakeBypass | null> => {
  const q = input.userQuestion.trim();
  const action =
    q === VAULT_WORKSPACE_UI_ENTRY
      ? ({ type: "list", folderRel: "" } as const)
      : matchVaultWorkspaceUiPrompt(q);
  if (!action) return null;

  const language = input.language === "en" ? "en" : "zh";
  const result = await runVaultWorkspaceOp({
    corpusUserId: input.corpusUserId,
    params: toParams(action),
    language,
  });

  return {
    decision: baseDirect(result.answer),
    answer: result.answer,
    assistantBlocks: result.blocks ?? null,
  };
};
