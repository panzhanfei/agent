import { describe, expect, it } from "vitest";
import {
  deriveCompositeSlotsFromPathPlan,
  legalizePathPlan,
  stepsOfKind,
} from "@/agentflow/agents/online/intake-coordinator";
import {
  matchVaultWorkspaceUiPrompt,
  VAULT_WORKSPACE_UI_ENTRY,
  vaultWsListPrompt,
} from "@/agentflow/agents/online/vault-write";

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
  });
});
