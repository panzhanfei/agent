import { describe, expect, it } from "vitest";
import {
  deriveCompositeSlotsFromPathPlan,
  ensureMemRecallStepFromTopUserFact,
  legalizeComposeMode,
  legalizePathPlan,
  stepsOfKind,
} from "@/agentflow/agents/online/intake-coordinator";
import {
  matchVaultWorkspaceUiPrompt,
  nextFromResume,
  resolveVaultWorkspaceUiBypass,
  VAULT_WORKSPACE_ACTION,
  VAULT_WORKSPACE_UI_ENTRY,
  vaultWsDonePrompt,
  vaultWsListPrompt,
  withVaultHitlDone,
} from "@/agentflow/agents/sideline/file";

describe("pathPlan vault_workspace", () => {
  it("legalizes list with empty targetPath", () => {
    const plan = legalizePathPlan({
      steps: [
        {
          id: "vault-list",
          kind: "vault_workspace",
          label: "原文库列表",
          searchQuery: "",
          queryType: "default",
          topics: ["personal"],
          params: { operation: "list", targetPath: "" },
        },
      ],
    });
    expect(stepsOfKind(plan, "vault_workspace")).toHaveLength(1);
    const slots = deriveCompositeSlotsFromPathPlan(plan);
    expect(slots[0]?.executor).toBe("vault_workspace");
    expect(slots[0]?.params?.operation).toBe("list");
  });

  it("legalizes open/update/delete_file", () => {
    const plan = legalizePathPlan({
      steps: [
        {
          id: "vault-open",
          kind: "vault_workspace",
          label: "打开",
          searchQuery: "notes/a.txt",
          queryType: "default",
          topics: ["personal"],
          params: { operation: "open", targetPath: "notes/a.txt" },
        },
      ],
    });
    expect(plan.steps[0]?.params?.operation).toBe("open");
    expect(deriveCompositeSlotsFromPathPlan(plan)[0]?.executor).toBe(
      "vault_workspace"
    );
  });

  it("coerces update with empty afterContent to open", () => {
    const plan = legalizePathPlan({
      steps: [
        {
          id: "vault-upd",
          kind: "vault_workspace",
          label: "更新",
          searchQuery: "a.txt",
          queryType: "default",
          topics: ["personal"],
          params: {
            operation: "update",
            targetPath: "a.txt",
            afterContent: "",
          },
        },
      ],
    });
    expect(plan.steps[0]?.params?.operation).toBe("open");
  });

  it("drops create_folder without name; drops delete without path", () => {
    const noName = legalizePathPlan({
      steps: [
        {
          id: "bad-folder",
          kind: "vault_workspace",
          label: "新建夹",
          searchQuery: "",
          queryType: "default",
          topics: [],
          params: { operation: "create_folder", targetPath: "" },
        },
      ],
    });
    expect(stepsOfKind(noName, "vault_workspace")).toHaveLength(0);

    const noPath = legalizePathPlan({
      steps: [
        {
          id: "bad-del",
          kind: "vault_workspace",
          label: "删",
          searchQuery: "",
          queryType: "default",
          topics: [],
          params: { operation: "delete_file", targetPath: "" },
        },
      ],
    });
    expect(stepsOfKind(noPath, "vault_workspace")).toHaveLength(0);
  });

  it("drops sibling km/list/mem when any vault_workspace step exists", () => {
    const plan = legalizePathPlan({
      steps: [
        {
          id: "km-age",
          kind: "km",
          label: "年龄",
          searchQuery: "年龄",
          queryType: "identity",
          topics: ["personal"],
          identityField: "age",
        },
        {
          id: "vault-list",
          kind: "vault_workspace",
          label: "原文库列表",
          searchQuery: "",
          queryType: "default",
          topics: ["personal"],
          params: { operation: "list", targetPath: "" },
        },
        {
          id: "vault-open",
          kind: "vault_workspace",
          label: "打开",
          searchQuery: "a.txt",
          queryType: "default",
          topics: ["personal"],
          params: { operation: "open", targetPath: "a.txt" },
        },
        {
          id: "list-exp",
          kind: "list",
          label: "履历",
          searchQuery: "履历",
          queryType: "enumeration",
          topics: ["experience"],
          enumerationControl: { action: "preview", listKind: "experience" },
        },
      ],
    });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.id).toBe("vault-list");
    expect(plan.steps[0]?.kind).toBe("vault_workspace");
    const slots = deriveCompositeSlotsFromPathPlan(plan);
    expect(slots).toHaveLength(1);
    expect(slots[0]?.executor).toBe("vault_workspace");
    expect(legalizeComposeMode("composite", plan)).toBe("qa");
  });

  it("does not inject mem recall beside a vault_workspace plan", () => {
    const plan = legalizePathPlan({
      steps: [
        {
          id: "vault-list",
          kind: "vault_workspace",
          label: "原文库列表",
          searchQuery: "",
          queryType: "default",
          topics: ["personal"],
          params: { operation: "list", targetPath: "" },
        },
      ],
    });
    const next = ensureMemRecallStepFromTopUserFact(
      {
        intent: "retrieve_and_answer",
        userFactKey: "qq",
        userFactLabel: "QQ",
        userFactValue: null,
      },
      plan
    );
    expect(next.steps).toHaveLength(1);
    expect(next.steps[0]?.kind).toBe("vault_workspace");
  });

  it("matches UI exact-match prompts", () => {
    expect(matchVaultWorkspaceUiPrompt(VAULT_WORKSPACE_UI_ENTRY)).toBeNull();
    expect(matchVaultWorkspaceUiPrompt(vaultWsListPrompt(""))).toEqual({
      type: "list",
      folderRel: "",
    });
    expect(matchVaultWorkspaceUiPrompt(vaultWsListPrompt("notes"))).toEqual({
      type: "list",
      folderRel: "notes",
    });
    expect(matchVaultWorkspaceUiPrompt(vaultWsDonePrompt())).toEqual({
      type: "done",
    });
    expect(matchVaultWorkspaceUiPrompt(VAULT_WORKSPACE_ACTION.donePrompt)).toEqual(
      { type: "done" }
    );
  });

  it("HITL done prompt resumes as done and bypasses to respondEarly", () => {
    expect(
      nextFromResume(
        { kind: "vault_action", prompt: vaultWsDonePrompt() },
        { operation: "list", targetPath: "" }
      )
    ).toEqual({ kind: "done" });
    const decision = resolveVaultWorkspaceUiBypass(vaultWsDonePrompt());
    expect(decision?.routeMode).toBe("respondEarly");
    expect(decision?.intent).toBe("direct_answer");
    expect(decision?.pathPlan.steps).toHaveLength(0);
    expect(decision?.briefReply).toBe("原文库操作已结束。");
  });

  it("appends an exact-match 结束 action for HITL pause", () => {
    const blocks = withVaultHitlDone([], "zh");
    expect(blocks).toEqual([
      {
        type: "actions",
        actions: [
          {
            id: "vault-ws-done",
            label: "结束",
            prompt: VAULT_WORKSPACE_ACTION.donePrompt,
            displayText: "结束原文库操作",
          },
        ],
      },
    ]);
  });
});
