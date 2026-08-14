/**
 * workspace txt → corpus md 语料化 + 向量 upsert/purge。
 * 首版：简单 md 包装（标题=文件名，正文=原文），不做 LLM 改写。
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Document } from "@langchain/core/documents";
import type { Logger } from "pino";
import {
  deleteCorpusVectorsByPath,
  inferCorpusDocKind,
  upsertCorpusDocumentsByPath,
} from "../vector";
import type { MaterializeResult, PurgeResult } from "./interface";
import { readVaultWorkspaceTxt } from "./workspace-fs";
import {
  normalizeWorkspaceRel,
  workspaceTxtToCorpusMdAbsPath,
} from "./workspace-paths";

export type { MaterializeResult, PurgeResult };

const noopLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
  child: () => noopLogger,
} as unknown as Logger;

const txtBasenameTitle = (workspaceRel: string): string => {
  const base = path.posix.basename(normalizeWorkspaceRel(workspaceRel));
  return base.toLowerCase().endsWith(".txt")
    ? base.slice(0, -".txt".length)
    : base;
};

export const materializeWorkspaceTxtToMarkdown = (
  workspaceRel: string,
  txtBody: string
): string => {
  const title = txtBasenameTitle(workspaceRel);
  const body = txtBody.replace(/\r\n/g, "\n");
  return `# ${title}\n\n${body.trimEnd()}\n`;
};

/** 同步语料化并更新向量 */
export const materializeWorkspaceTxt = async (input: {
  corpusUserId: string;
  workspaceRel: string;
  /** 若已读过可传入，否则从盘读取 */
  txtContent?: string;
  indexAfter?: boolean;
  logger?: Logger;
}): Promise<MaterializeResult> => {
  const workspaceRel = normalizeWorkspaceRel(input.workspaceRel);
  const mapped = workspaceTxtToCorpusMdAbsPath(
    input.corpusUserId,
    workspaceRel
  );
  if (!mapped) throw new Error("无法映射 workspace txt → corpus md");

  const txt =
    input.txtContent ??
    (await readVaultWorkspaceTxt(input.corpusUserId, workspaceRel));
  const md = materializeWorkspaceTxtToMarkdown(workspaceRel, txt);
  await mkdir(path.dirname(mapped.absPath), { recursive: true });
  await writeFile(mapped.absPath, md, "utf8");

  let deletedVectors = 0;
  let upserted = 0;
  let indexed = false;
  if (input.indexAfter !== false) {
    const up = await upsertCorpusDocumentsByPath(
      input.corpusUserId,
      mapped.repoPath,
      [
        new Document({
          pageContent: md,
          metadata: {
            path: mapped.repoPath,
            sourcePath: `vault/originals/workspace/${workspaceRel}`,
            title: txtBasenameTitle(workspaceRel),
            docKind: inferCorpusDocKind(mapped.repoPath, md),
          },
        }),
      ],
      input.logger ?? noopLogger
    );
    deletedVectors = up.deleted ? 1 : 0;
    upserted = up.chunkCount;
    indexed = true;
  }

  return {
    workspaceRel,
    mdRepoPath: mapped.repoPath,
    mdAbsPath: mapped.absPath,
    indexed,
    deletedVectors,
    upserted,
  };
};

/** 硬删对应 md + 向量（源 txt 由调用方已删或另行删除） */
export const purgeWorkspaceMaterialized = async (input: {
  corpusUserId: string;
  workspaceRel: string;
}): Promise<PurgeResult> => {
  const workspaceRel = normalizeWorkspaceRel(input.workspaceRel);
  const mapped = workspaceTxtToCorpusMdAbsPath(
    input.corpusUserId,
    workspaceRel
  );
  if (!mapped) {
    return {
      workspaceRel,
      mdRepoPath: null,
      mdDeleted: false,
      vectorsDeleted: 0,
    };
  }
  await rm(mapped.absPath, { force: true });
  const { deleted } = await deleteCorpusVectorsByPath(
    input.corpusUserId,
    mapped.repoPath
  );
  return {
    workspaceRel,
    mdRepoPath: mapped.repoPath,
    mdDeleted: true,
    vectorsDeleted: deleted ? 1 : 0,
  };
};

export const purgeWorkspaceTxtCascade = async (input: {
  corpusUserId: string;
  workspaceRels: string[];
}): Promise<PurgeResult[]> => {
  const out: PurgeResult[] = [];
  for (const rel of input.workspaceRels) {
    out.push(
      await purgeWorkspaceMaterialized({
        corpusUserId: input.corpusUserId,
        workspaceRel: rel,
      })
    );
  }
  return out;
};

/** 读盘校验 md 是否存在 */
export const readMaterializedMd = async (
  corpusUserId: string,
  workspaceRel: string
): Promise<string | null> => {
  const mapped = workspaceTxtToCorpusMdAbsPath(corpusUserId, workspaceRel);
  if (!mapped) return null;
  try {
    return await readFile(mapped.absPath, "utf8");
  } catch {
    return null;
  }
};
