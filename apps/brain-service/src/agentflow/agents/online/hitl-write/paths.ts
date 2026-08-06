/**
 * 语料写路径白名单：仅 corpus/{personal,experience,projects} 下 .md
 * （结构规则，非口语猜 path）
 */
import path from "node:path";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import {
  getDocRoot,
  getUserCorpusRoot,
  SCAN_FOLDERS,
  type CorpusCategory,
} from "@fambrain/corpus";

const CATEGORY_SET = new Set<string>(SCAN_FOLDERS);

export const normalizeRepoPath = (raw: string): string =>
  raw
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/")
    .trim();

/** repo 相对 path → 绝对路径；非法则 null */
export const resolveCorpusMarkdownAbsPath = (
  corpusUserId: string,
  repoPath: string
): { absPath: string; repoPath: string; category: CorpusCategory } | null => {
  const normalized = normalizeRepoPath(repoPath);
  if (!normalized || normalized.includes("..")) return null;
  if (!normalized.toLowerCase().endsWith(".md")) return null;

  const prefix = `users/${corpusUserId}/corpus/`;
  let relativeUnderCorpus: string;
  if (normalized.startsWith(prefix)) {
    relativeUnderCorpus = normalized.slice(prefix.length);
  } else if (normalized.startsWith("corpus/")) {
    relativeUnderCorpus = normalized.slice("corpus/".length);
  } else {
    // 允许 Intake 只给 corpus 下相对段：personal/xxx.md
    relativeUnderCorpus = normalized;
  }

  const category = relativeUnderCorpus.split("/")[0] ?? "";
  if (!CATEGORY_SET.has(category)) return null;

  const absPath = path.join(
    getUserCorpusRoot(corpusUserId),
    ...relativeUnderCorpus.split("/")
  );
  const canonRepo = path
    .join("users", corpusUserId, "corpus", relativeUnderCorpus)
    .split(path.sep)
    .join("/");

  // 必须落在该用户 corpus 根下
  const corpusRoot = path.resolve(getUserCorpusRoot(corpusUserId));
  const resolved = path.resolve(absPath);
  if (!resolved.startsWith(corpusRoot + path.sep) && resolved !== corpusRoot) {
    return null;
  }

  return {
    absPath: resolved,
    repoPath: canonRepo,
    category: category as CorpusCategory,
  };
};

export const fileExists = async (absPath: string): Promise<boolean> => {
  try {
    await access(absPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export const docRoot = (): string => getDocRoot();
