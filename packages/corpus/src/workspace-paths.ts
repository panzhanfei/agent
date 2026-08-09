/**
 * 用户可编辑原文库（vault txt）路径契约。
 * workspace 下仅 .txt + 文件夹；语料 md 为派生产物。
 */
import path from "node:path";
import {
  CORPUS_IMPORTS_DIR,
  getUserCorpusRoot,
  getUserVaultRoot,
} from "./doc-paths";

/** vault/originals/workspace — 用户 CRUD 根 */
export const VAULT_WORKSPACE_DIR = "originals/workspace";

/** 语料产物根（相对 corpus）：personal/imports/workspace */
export const CORPUS_WORKSPACE_IMPORTS_REL = path.posix.join(
  "personal",
  CORPUS_IMPORTS_DIR,
  "workspace"
);

export type VaultWorkspaceEntryKind = "file" | "folder";

export type VaultWorkspaceEntry = {
  kind: VaultWorkspaceEntryKind;
  /** 相对 workspace 根，如 `notes` 或 `notes/a.txt`；根级用 "" */
  relativePath: string;
  name: string;
  sizeBytes?: number;
  modifiedAt?: string;
};

export const normalizeWorkspaceRel = (raw: string): string =>
  raw
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .trim();

export const getVaultWorkspaceRoot = (userId: string): string =>
  path.join(getUserVaultRoot(userId), ...VAULT_WORKSPACE_DIR.split("/"));

/** workspace 相对 path → 绝对路径；非法则 null */
export const resolveVaultWorkspaceAbsPath = (
  userId: string,
  relativePath: string
): { absPath: string; relativePath: string } | null => {
  const rel = normalizeWorkspaceRel(relativePath);
  if (rel.includes("..")) return null;
  const root = path.resolve(getVaultWorkspaceRoot(userId));
  const abs = path.resolve(root, ...rel.split("/").filter(Boolean));
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return { absPath: abs, relativePath: rel };
};

/** workspace 相对 txt → corpus md 的 repo 相对 path（posix） */
export const workspaceTxtToCorpusMdRepoPath = (
  corpusUserId: string,
  workspaceRelTxt: string
): string | null => {
  const rel = normalizeWorkspaceRel(workspaceRelTxt);
  if (!rel || !rel.toLowerCase().endsWith(".txt") || rel.includes("..")) {
    return null;
  }
  const withoutExt = rel.slice(0, -".txt".length);
  const mdRel = `${CORPUS_WORKSPACE_IMPORTS_REL}/${withoutExt}.md`;
  return path.posix.join("users", corpusUserId, "corpus", mdRel);
};

export const workspaceTxtToCorpusMdAbsPath = (
  corpusUserId: string,
  workspaceRelTxt: string
): { absPath: string; repoPath: string } | null => {
  const repoPath = workspaceTxtToCorpusMdRepoPath(
    corpusUserId,
    workspaceRelTxt
  );
  if (!repoPath) return null;
  const underCorpus = repoPath.replace(`users/${corpusUserId}/corpus/`, "");
  const absPath = path.join(
    getUserCorpusRoot(corpusUserId),
    ...underCorpus.split("/")
  );
  return { absPath, repoPath };
};

/** 是否为允许的 workspace 文件名（仅 .txt） */
export const isWorkspaceTxtName = (name: string): boolean => {
  const n = name.trim();
  if (!n || n.includes("/") || n.includes("\\") || n.includes("..")) {
    return false;
  }
  return n.toLowerCase().endsWith(".txt");
};

export const isSafeWorkspaceSegment = (name: string): boolean => {
  const n = name.trim();
  if (!n || n.includes("/") || n.includes("\\") || n.includes("..")) {
    return false;
  }
  if (n === "." || n === "..") return false;
  return !/[<>:"|?*\x00-\x1f]/.test(n);
};
