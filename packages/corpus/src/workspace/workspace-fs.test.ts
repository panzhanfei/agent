import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createVaultWorkspaceFolder,
  createVaultWorkspaceTxt,
  deleteVaultWorkspaceFolder,
  deleteVaultWorkspaceTxt,
  listVaultWorkspaceDir,
  readVaultWorkspaceTxt,
  writeVaultWorkspaceTxt,
} from "./workspace-fs";
import { workspaceTxtToCorpusMdRepoPath } from "./workspace-paths";
import { materializeWorkspaceTxtToMarkdown as wrapMd } from "./workspace-materialize";

describe("workspace-fs CRUD", () => {
  let docRoot: string;
  const userId = "test-vault-user";

  beforeEach(async () => {
    docRoot = await mkdtemp(path.join(os.tmpdir(), "fambrain-vault-"));
    process.env.FAMBRAIN_DOC_ROOT_OVERRIDE = docRoot;
  });

  afterEach(async () => {
    delete process.env.FAMBRAIN_DOC_ROOT_OVERRIDE;
    await rm(docRoot, { recursive: true, force: true });
  });

  it("lists empty root and creates folder/file", async () => {
    expect(await listVaultWorkspaceDir(userId, "")).toEqual([]);
    await createVaultWorkspaceFolder(userId, "", "notes");
    await createVaultWorkspaceTxt(userId, "notes", "a.txt", "hello");
    const entries = await listVaultWorkspaceDir(userId, "");
    expect(entries.map((e) => e.name)).toEqual(["notes"]);
    const nested = await listVaultWorkspaceDir(userId, "notes");
    expect(nested).toHaveLength(1);
    expect(nested[0]?.name).toBe("a.txt");
    expect(await readVaultWorkspaceTxt(userId, "notes/a.txt")).toBe("hello");
  });

  it("updates and hard-deletes file + folder cascade", async () => {
    await createVaultWorkspaceFolder(userId, "", "notes");
    await createVaultWorkspaceTxt(userId, "notes", "a.txt", "v1");
    await writeVaultWorkspaceTxt(userId, "notes/a.txt", "v2");
    expect(await readVaultWorkspaceTxt(userId, "notes/a.txt")).toBe("v2");
    await deleteVaultWorkspaceTxt(userId, "notes/a.txt");
    expect(await listVaultWorkspaceDir(userId, "notes")).toEqual([]);
    await createVaultWorkspaceTxt(userId, "notes", "b.txt", "x");
    const { deletedTxtRels } = await deleteVaultWorkspaceFolder(
      userId,
      "notes",
      { recursive: true }
    );
    expect(deletedTxtRels).toEqual(["notes/b.txt"]);
    expect(await listVaultWorkspaceDir(userId, "")).toEqual([]);
  });

  it("md wrap + path mapping", () => {
    expect(wrapMd("notes/a.txt", "body")).toContain("# a");
    expect(wrapMd("notes/a.txt", "body")).toContain("body");
    expect(workspaceTxtToCorpusMdRepoPath(userId, "notes/a.txt")).toContain(
      "personal/imports/workspace/notes/a.md"
    );
  });
});
