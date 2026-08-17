/**
 * UI exact-match：路由至 vault_workspace 工人，不在 Intake 执行 CRUD。
 */
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import {
  deriveCompositeSlotsFromPathPlan,
  deriveRetrievalPlanFromPathPlan,
  emptyPathPlan,
  legalizePathPlan,
} from "@/agentflow/agents/online/intake-coordinator/path-plan";
import {
  buildEarlyExitRoutedDecision,
  resolveIntakeGraphRouteMode,
} from "@/agentflow/agents/online/intake-coordinator/pipeline";
import type { PipelineResumePayload } from "@/agentflow/execution";
import {
  matchVaultWorkspaceUiPrompt,
  VAULT_WORKSPACE_ACTION,
  VAULT_WORKSPACE_UI_ENTRY,
  vaultWorkspaceDoneReply,
} from "../actions";
import type { VaultWorkspaceParams } from "../interface";
import type { VaultResumeNext, VaultWsFileAction, VaultWsUiAction } from "./interface";

export type { VaultResumeNext } from "./interface";

export const toVaultWorkspaceParams = (
  action: VaultWsFileAction
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
  action: VaultWsFileAction
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

const buildVaultWorkspaceDoneDecision = (): RoutedIntakeDecision =>
  buildEarlyExitRoutedDecision({
    intent: "direct_answer",
    searchQuery: "",
    subTasks: [],
    topics: [],
    language: "zh",
    confidence: 1,
    queryType: null,
    clarifyingQuestion: null,
    briefReply: vaultWorkspaceDoneReply("zh"),
    retrievalPlan: [],
    userFactKey: null,
    userFactLabel: null,
    userFactValue: null,
    pathPlan: emptyPathPlan(),
    answerOrder: [],
    composeMode: "qa",
  });

/** UI exact-match：只产出 vault 槽决策，不跑 CRUD。结束按钮走 respondEarly。 */
export const resolveVaultWorkspaceUiBypass = (
  userQuestion: string
): RoutedIntakeDecision | null => {
  const action = matchVaultWorkspaceUiAction(userQuestion);
  if (!action) return null;
  if (action.type === "done") return buildVaultWorkspaceDoneDecision();
  return buildVaultWorkspaceUiDecision(action);
};

const isVaultActionResume = (
  resume: unknown
): resume is PipelineResumePayload => {
  if (!resume || typeof resume !== "object") return false;
  const r = resume as { kind?: unknown; prompt?: unknown };
  return r.kind === "vault_action" && typeof r.prompt === "string";
};

/** Resume：结束 → 节点 return；其余解析为下一步 params。无法识别则沿用当前 params。 */
export const nextFromResume = (
  resume: unknown,
  fallback: VaultWorkspaceParams
): VaultResumeNext => {
  if (!isVaultActionResume(resume)) return { kind: "continue", params: fallback };
  const q = resume.prompt.trim();
  if (!q) return { kind: "continue", params: fallback };
  if (q === VAULT_WORKSPACE_ACTION.donePrompt) return { kind: "done" };
  const action =
    q === VAULT_WORKSPACE_UI_ENTRY
      ? ({ type: "list", folderRel: "" } as const)
      : matchVaultWorkspaceUiPrompt(q);
  if (!action) return { kind: "continue", params: fallback };
  if (action.type === "done") return { kind: "done" };
  return { kind: "continue", params: toVaultWorkspaceParams(action) };
};

/** 将 Resume 的 vault_action.prompt 解析为下一步 params；结束或无法识别则沿用当前 params。 */
export const paramsFromResume = (
  resume: unknown,
  fallback: VaultWorkspaceParams
): VaultWorkspaceParams => {
  const next = nextFromResume(resume, fallback);
  return next.kind === "done" ? fallback : next.params;
};
