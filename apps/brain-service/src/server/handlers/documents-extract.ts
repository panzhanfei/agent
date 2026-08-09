import type { IncomingMessage, ServerResponse } from "node:http";
import {
  docParserLogger,
  extractAndStageDocumentBatch,
} from "@/agentflow/agents/offline/doc-parser";
import { requireAuth } from "@/server/middleware";
import { parseMultipartRequest } from "@/server/http";

/**
 * POST /documents/extract — 聊天附件：仅抽取文本并暂存，不入库。
 */
export const handleDocumentsExtract = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "method not allowed" }));
    return;
  }
  const actorUserId = await requireAuth(req, res);
  if (!actorUserId) return;

  let multipart;
  try {
    multipart = await parseMultipartRequest(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid multipart body";
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg }));
    return;
  }

  if (multipart.files.length === 0) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "请至少上传 1 个文件（字段名 files）" }));
    return;
  }

  try {
    const result = await extractAndStageDocumentBatch(
      multipart.files.map((f) => ({
        fileName: f.fileName,
        buffer: f.buffer,
      })),
      { actorUserId, logger: docParserLogger }
    );

    if (result.okCount === 0) {
      const firstErr =
        result.files.find((f) => f.error)?.error ?? "未能从附件提取有效文本";
      res.writeHead(422, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: firstErr,
          batchId: result.batchId,
          files: result.files,
          okCount: 0,
          failCount: result.failCount,
        })
      );
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "附件文字抽取失败";
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg }));
  }
};
