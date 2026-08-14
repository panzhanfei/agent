/**
 * vault/originals/workspace 两层 list + txt/文件夹 CRUD（硬删除）。
 */
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  getVaultWorkspaceRoot,
  isSafeWorkspaceSegment,
  isWorkspaceTxtName,
  normalizeWorkspaceRel,
  resolveVaultWorkspaceAbsPath,
  type VaultWorkspaceEntry,
} from "./workspace-paths";

export const ensureVaultWorkspaceRoot = async (
  userId: string
): Promise<string> => {
  const root = getVaultWorkspaceRoot(userId);
  await mkdir(root, { recursive: true });
  return root;
};

/** 列出 workspace 下一层（folderRel="" 为根） */
export const listVaultWorkspaceDir = async (
  userId: string,
  folderRel = ""
): Promise<VaultWorkspaceEntry[]> => {
  await ensureVaultWorkspaceRoot(userId);
  const resolved = resolveVaultWorkspaceAbsPath(userId, folderRel);
  if (!resolved) throw new Error("非法文件夹路径");
  let entries;
  try {
    entries = await readdir(resolved.absPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: VaultWorkspaceEntry[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const childRel = normalizeWorkspaceRel(
      path.posix.join(folderRel, entry.name)
    );
    if (entry.isDirectory()) {
      out.push({
        kind: "folder",
        relativePath: childRel,
        name: entry.name,
      });
      continue;
    }
    if (!entry.isFile() || !isWorkspaceTxtName(entry.name)) continue;
    const st = await stat(path.join(resolved.absPath, entry.name)).catch(
      () => null
    );
    out.push({
      kind: "file",
      relativePath: childRel,
      name: entry.name,
      sizeBytes: st?.size,
      modifiedAt: st?.mtime.toISOString(),
    });
  }
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh");
  });
  return out;
};

export const readVaultWorkspaceTxt = async (
  userId: string,
  relativePath: string
): Promise<string> => {
  const resolved = resolveVaultWorkspaceAbsPath(userId, relativePath);
  if (!resolved || !resolved.relativePath.toLowerCase().endsWith(".txt")) {
    throw new Error("非法 txt 路径");
  }
  return readFile(resolved.absPath, "utf8");
};

export const writeVaultWorkspaceTxt = async (
  userId: string,
  relativePath: string,
  content: string
): Promise<{ relativePath: string }> => {
  const rel = normalizeWorkspaceRel(relativePath);
  if (!rel.toLowerCase().endsWith(".txt")) {
    throw new Error("仅允许 .txt");
  }
  const resolved = resolveVaultWorkspaceAbsPath(userId, rel);
  if (!resolved) throw new Error("非法 txt 路径");
  await mkdir(path.dirname(resolved.absPath), { recursive: true });
  await writeFile(resolved.absPath, content, "utf8");
  return { relativePath: resolved.relativePath };
};

export const createVaultWorkspaceFolder = async (
  userId: string,
  parentRel: string,
  folderName: string
): Promise<{ relativePath: string }> => {
  if (!isSafeWorkspaceSegment(folderName)) {
    throw new Error("非法文件夹名");
  }
  const rel = normalizeWorkspaceRel(
    path.posix.join(parentRel, folderName)
  );
  const resolved = resolveVaultWorkspaceAbsPath(userId, rel);
  if (!resolved) throw new Error("非法文件夹路径");
  await mkdir(resolved.absPath, { recursive: true });
  return { relativePath: resolved.relativePath };
};

export const createVaultWorkspaceTxt = async (
  userId: string,
  parentRel: string,
  fileName: string,
  content = ""
): Promise<{ relativePath: string }> => {
  const name = fileName.toLowerCase().endsWith(".txt")
    ? fileName
    : `${fileName}.txt`;
  if (!isWorkspaceTxtName(name) || !isSafeWorkspaceSegment(name)) {
    throw new Error("非法文件名（须为 .txt）");
  }
  const rel = normalizeWorkspaceRel(path.posix.join(parentRel, name));
  return writeVaultWorkspaceTxt(userId, rel, content);
};

/** 硬删除 txt */
export const deleteVaultWorkspaceTxt = async (
  userId: string,
  relativePath: string
): Promise<{ relativePath: string }> => {
  const resolved = resolveVaultWorkspaceAbsPath(userId, relativePath);
  if (!resolved || !resolved.relativePath.toLowerCase().endsWith(".txt")) {
    throw new Error("非法 txt 路径");
  }
  await rm(resolved.absPath, { force: true });
  return { relativePath: resolved.relativePath };
};

/**
 * 硬删除文件夹。
 * recursive=false 时仅空目录；true 时级联删内全部 txt/子目录。
 */
export const deleteVaultWorkspaceFolder = async (
  userId: string,
  relativePath: string,
  opts?: { recursive?: boolean }
): Promise<{ relativePath: string; deletedTxtRels: string[] }> => {
  const rel = normalizeWorkspaceRel(relativePath);
  if (!rel) throw new Error("不能删除 workspace 根");
  const resolved = resolveVaultWorkspaceAbsPath(userId, rel);
  if (!resolved) throw new Error("非法文件夹路径");
  const deletedTxtRels: string[] = [];
  const collectTxt = async (dirAbs: string, dirRel: string) => {
    const entries = await readdir(dirAbs, { withFileTypes: true }).catch(
      () => []
    );
    for (const e of entries) {
      const childAbs = path.join(dirAbs, e.name);
      const childRel = normalizeWorkspaceRel(path.posix.join(dirRel, e.name));
      if (e.isDirectory()) await collectTxt(childAbs, childRel);
      else if (e.isFile() && isWorkspaceTxtName(e.name)) {
        deletedTxtRels.push(childRel);
      }
    }
  };
  await collectTxt(resolved.absPath, rel);
  if (!opts?.recursive) {
    const entries = await readdir(resolved.absPath).catch(() => null);
    if (entries && entries.length > 0) {
      throw new Error("文件夹非空：请确认级联删除或先清空");
    }
  }
  await rm(resolved.absPath, {
    recursive: Boolean(opts?.recursive),
    force: true,
  });
  return { relativePath: rel, deletedTxtRels };
};

export const renameVaultWorkspaceEntry = async (
  userId: string,
  fromRel: string,
  toRel: string
): Promise<{ from: string; to: string }> => {
  const from = resolveVaultWorkspaceAbsPath(userId, fromRel);
  const to = resolveVaultWorkspaceAbsPath(userId, toRel);
  if (!from || !to) throw new Error("非法重命名路径");
  await mkdir(path.dirname(to.absPath), { recursive: true });
  await rename(from.absPath, to.absPath);
  return { from: from.relativePath, to: to.relativePath };
};
