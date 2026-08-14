import { describe, expect, it } from "vitest";
import {
  normalizeWorkspaceRel,
  resolveVaultWorkspaceAbsPath,
  workspaceTxtToCorpusMdRepoPath,
  isWorkspaceTxtName,
} from "./workspace-paths";

describe("workspace-paths contract", () => {
  it("normalizes and rejects traversal", () => {
    expect(normalizeWorkspaceRel("/a//b/")).toBe("a/b");
    expect(resolveVaultWorkspaceAbsPath("u1", "../x")).toBeNull();
    expect(resolveVaultWorkspaceAbsPath("u1", "ok/a.txt")?.relativePath).toBe(
      "ok/a.txt"
    );
  });

  it("maps txt → personal/imports/workspace md repo path", () => {
    expect(workspaceTxtToCorpusMdRepoPath("u1", "notes/hello.txt")).toBe(
      "users/u1/corpus/personal/imports/workspace/notes/hello.md"
    );
    expect(workspaceTxtToCorpusMdRepoPath("u1", "notes/hello.md")).toBeNull();
  });

  it("only allows .txt names", () => {
    expect(isWorkspaceTxtName("a.txt")).toBe(true);
    expect(isWorkspaceTxtName("a.md")).toBe(false);
    expect(isWorkspaceTxtName("../a.txt")).toBe(false);
  });
});
