/**
 * 聊天附件暂存：抽取文本 + 保留原件 buffer（供后续入库）。
 * 选文件时不调用；发送后由 /documents/extract 写入，pipeline 按 batchId 读取。
 */
import { randomUUID } from "node:crypto";
import pLimit from "p-limit";
import type { Logger } from "pino";
import { getDocParseConcurrency } from "./ingest-batch";
import { parseDocumentContent } from "./parse-file";
import { detectDocFormat, isSupportedDocFile } from "./supported-formats";

export type TurnAttachmentFile = {
  fileName: string;
  title: string;
  text: string;
  format: string;
  ok: boolean;
  error?: string;
  textLength: number;
};

export type StagedAttachmentFile = TurnAttachmentFile & {
  buffer: Buffer;
};

export type AttachmentBatch = {
  batchId: string;
  actorUserId: string;
  createdAt: number;
  files: StagedAttachmentFile[];
};

const TTL_MS = 30 * 60 * 1000;
const store = new Map<string, AttachmentBatch>();

const sweepExpired = (): void => {
  const now = Date.now();
  for (const [id, batch] of store) {
    if (now - batch.createdAt > TTL_MS) store.delete(id);
  }
};

export const getAttachmentBatch = (
  batchId: string,
  actorUserId: string
): AttachmentBatch | null => {
  sweepExpired();
  const batch = store.get(batchId);
  if (!batch) return null;
  if (batch.actorUserId !== actorUserId) return null;
  return batch;
};

export const releaseAttachmentBatch = (batchId: string): void => {
  store.delete(batchId);
};

export type ExtractFileInput = {
  fileName: string;
  buffer: Buffer;
};

export type ExtractBatchResult = {
  batchId: string;
  files: TurnAttachmentFile[];
  okCount: number;
  failCount: number;
};

const extractOne = async (
  input: ExtractFileInput
): Promise<StagedAttachmentFile> => {
  const { fileName, buffer } = input;
  if (!isSupportedDocFile(fileName)) {
    return {
      fileName,
      title: fileName,
      text: "",
      format: "unsupported",
      ok: false,
      error: `不支持的文件类型：${fileName}`,
      textLength: 0,
      buffer,
    };
  }
  try {
    const content = await parseDocumentContent(buffer, fileName);
    return {
      fileName,
      title: content.title,
      text: content.text,
      format: content.format,
      ok: true,
      textLength: content.text.length,
      buffer,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      fileName,
      title: fileName,
      text: "",
      format: detectDocFormat(fileName),
      ok: false,
      error: msg,
      textLength: 0,
      buffer,
    };
  }
};

/** 抽取文本并暂存原件；不写 corpus、不建索引。 */
export const extractAndStageDocumentBatch = async (
  files: ExtractFileInput[],
  options: { actorUserId: string; logger?: Logger }
): Promise<ExtractBatchResult> => {
  if (files.length === 0) {
    throw new Error("至少上传 1 个文件");
  }
  sweepExpired();
  const limit = pLimit(getDocParseConcurrency());
  options.logger?.info(
    { fileCount: files.length, actorUserId: options.actorUserId },
    "attachment extract batch started"
  );
  const staged = await Promise.all(
    files.map((file) => limit(() => extractOne(file)))
  );
  const batchId = randomUUID();
  store.set(batchId, {
    batchId,
    actorUserId: options.actorUserId,
    createdAt: Date.now(),
    files: staged,
  });
  const publicFiles: TurnAttachmentFile[] = staged.map(
    ({ buffer: _b, ...rest }) => rest
  );
  const okCount = publicFiles.filter((f) => f.ok).length;
  options.logger?.info(
    { batchId, okCount, failCount: publicFiles.length - okCount },
    "attachment extract batch done"
  );
  return {
    batchId,
    files: publicFiles,
    okCount,
    failCount: publicFiles.length - okCount,
  };
};

export const turnAttachmentsFromBatch = (
  batch: AttachmentBatch
): TurnAttachmentFile[] =>
  batch.files
    .filter((f) => f.ok && f.text.trim())
    .map(({ buffer: _b, ...rest }) => rest);

export const joinAttachmentTexts = (files: TurnAttachmentFile[]): string =>
  files
    .filter((f) => f.ok && f.text.trim())
    .map((f) => `## ${f.title || f.fileName}\n\n${f.text.trim()}`)
    .join("\n\n---\n\n");
