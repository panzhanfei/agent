/**
 * 将已抽取暂存的聊天附件写入 corpus 并可选建索引。
 */
import type { Logger } from "pino";
import {
  getAttachmentBatch,
  releaseAttachmentBatch,
} from "./attachment-stage";
import { formatDocParseBatchSummary } from "./format-import-summary";
import { ingestDocumentBatch } from "./ingest-batch";

export const ingestStagedAttachmentBatch = async (input: {
  batchId: string;
  actorUserId: string;
  corpusUserId: string;
  indexAfter?: boolean;
  logger?: Logger;
}): Promise<{ ok: true; summary: string } | { ok: false; error: string }> => {
  const batch = getAttachmentBatch(input.batchId, input.actorUserId);
  if (!batch) {
    return { ok: false, error: "附件批次已过期或不存在，请重新选择文件后再发送" };
  }
  const okFiles = batch.files.filter((f) => f.ok && f.text.trim());
  if (okFiles.length === 0) {
    return { ok: false, error: "没有可入库的附件文本" };
  }
  try {
    const result = await ingestDocumentBatch(
      okFiles.map((f) => ({
        fileName: f.fileName,
        buffer: f.buffer,
      })),
      {
        actorUserId: input.actorUserId,
        corpusUserId: input.corpusUserId,
        indexAfter: input.indexAfter ?? true,
        logger: input.logger,
      }
    );
    releaseAttachmentBatch(input.batchId);
    return { ok: true, summary: formatDocParseBatchSummary(result) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "附件入库失败";
    return { ok: false, error: msg };
  }
};
