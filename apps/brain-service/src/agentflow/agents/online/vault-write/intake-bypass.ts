/**
 * UI exact-match：只路由进 vault_workspace 工人，不在 Intake 里跑 CRUD。
 * 图在工人内 Pause 等人点按钮（同一件原文库任务）。
 */
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import {
  deriveCompositeSlotsFromPathPlan,
  deriveRetrievalPlanFromPathPlan,
  legalizePathPlan,
} from "@/agentflow/agents/online/intake-coordinator/path-plan";
import { resolveIntakeGraphRouteMode } from "@/agentflow/agents/online/intake-coordinator/pipeline";
import {
  matchVaultWorkspaceUiPrompt,
  VAULT_WORKSPACE_UI_ENTRY,
  type VaultWsUiAction,
} from "./actions";
import type { VaultWorkspaceParams } from "./interface";

export const toVaultWorkspaceParams = (
  action: VaultWsUiAction
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

export const matchVaultWorkspaceUiAction = (
  userQuestion: string
): VaultWsUiAction | null => {
  const q = userQuestion.trim();
  if (!q) return null;
  if (q === VAULT_WORKSPACE_UI_ENTRY) {
    return { type: "list", folderRel: "" };
  }
  return matchVaultWorkspaceUiPrompt(q);
};

export const buildVaultWorkspaceUiDecision = (
  action: VaultWsUiAction
): RoutedIntakeDecision => {
  const params = toVaultWorkspaceParams(action);
  const pathPlan = legalizePathPlan({
    steps: [
      {
        id: "vault-ui",
        kind: "vault_workspace",
        label: "原文库",
        searchQuery: params.targetPath ?? "",
        queryType: "default",
        topics: ["personal"],
        params,
      },
    ],
  });
  const compositeSlots = deriveCompositeSlotsFromPathPlan(pathPlan);
  const retrievalPlan = deriveRetrievalPlanFromPathPlan(pathPlan);
  const routed: RoutedIntakeDecision = {
    intent: "retrieve_and_answer",
    searchQuery: params.targetPath ?? "",
    subTasks: ["原文库"],
    topics: ["personal"],
    language: "zh",
    confidence: 1,
    queryType: "default",
    clarifyingQuestion: null,
    briefReply: null,
    retrievalPlan,
    userFactKey: null,
    userFactLabel: null,
    userFactValue: null,
    pathPlan,
    answerOrder: pathPlan.steps.map((s) => s.id),
    composeMode: "qa",
    compositeSlots,
    routeMode: "planFanOut",
    routeReason: "intake_path_plan",
    routePlanSource: "intake_path_plan",
    listIntent: null,
  };
  routed.routeMode = resolveIntakeGraphRouteMode(routed);
  return routed;
};

/** @deprecated 旧名；现只路由，不执行 op */
export const resolveVaultWorkspaceUiBypass = async (input: {
  userQuestion: string;
  corpusUserId: string;
  language?: "zh" | "en";
}): Promise<{ decision: RoutedIntakeDecision } | null> => {
  void input.corpusUserId;
  void input.language;
  const action = matchVaultWorkspaceUiAction(input.userQuestion);
  if (!action) return null;
  return { decision: buildVaultWorkspaceUiDecision(action) };
};
