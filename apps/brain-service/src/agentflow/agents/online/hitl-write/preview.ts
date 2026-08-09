/**
 * B：打开/预览语料 md（只读；不写盘、不建提案）
 */
import { readFile } from "node:fs/promises";
import { fileExists, resolveCorpusMarkdownAbsPath } from "./paths";

export const previewCorpusMarkdown = async (input: {
  corpusUserId: string;
  targetPath: string;
}): Promise<
  | { ok: true; repoPath: string; content: string }
  | { ok: false; error: string }
> => {
  const resolved = resolveCorpusMarkdownAbsPath(
    input.corpusUserId,
    input.targetPath
  );
  if (!resolved) return { ok: false, error: "path_not_allowed" };
  if (!(await fileExists(resolved.absPath))) {
    return { ok: false, error: "file_not_found" };
  }
  const content = await readFile(resolved.absPath, "utf8");
  return { ok: true, repoPath: resolved.repoPath, content };
};
