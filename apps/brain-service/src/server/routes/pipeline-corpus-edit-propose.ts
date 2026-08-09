import type { IncomingMessage, ServerResponse } from "node:http";
import {
  proposeCorpusEditFromApi,
  previewCorpusMarkdown,
} from "@/agentflow/agents/online/hitl-write";
import { requireAuth } from "@/server/middleware";
import {
  corpusEditContentQuerySchema,
  corpusEditProposeBodySchema,
} from "@/server/schema";
import { readJsonBody } from "@/server/http";

/** POST /pipeline/corpus-edit/propose — 编辑器结构化提交提案 */
export const handlePipelineCorpusEditPropose = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "method not allowed" }));
    return;
  }
  const userId = await requireAuth(req, res);
  if (!userId) return;

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid body";
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg }));
    return;
  }

  const parsed = corpusEditProposeBodySchema.safeParse(body);
  if (!parsed.success) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: parsed.error.message }));
    return;
  }

  const corpusUserId = parsed.data.corpusUserId ?? userId;
  const result = await proposeCorpusEditFromApi({
    userId,
    corpusUserId,
    conversationId: parsed.data.conversationId,
    targetPath: parsed.data.targetPath,
    operation: parsed.data.operation,
    afterContent: parsed.data.afterContent,
  });

  if (!result.ok) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: result.error }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      ok: true,
      proposal: result.proposal,
      answer: result.answer,
      blocks: result.blocks,
    })
  );
};

/** GET /pipeline/corpus-edit/content?corpusUserId=&targetPath= — 编辑器读盘 */
export const handlePipelineCorpusEditContent = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "method not allowed" }));
    return;
  }
  const userId = await requireAuth(req, res);
  if (!userId) return;

  const url = new URL(req.url ?? "/", "http://localhost");
  const parsed = corpusEditContentQuerySchema.safeParse({
    corpusUserId: url.searchParams.get("corpusUserId") ?? userId,
    targetPath: url.searchParams.get("targetPath") ?? "",
  });
  if (!parsed.success) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: parsed.error.message }));
    return;
  }

  const preview = await previewCorpusMarkdown({
    corpusUserId: parsed.data.corpusUserId,
    targetPath: parsed.data.targetPath,
  });
  if (!preview.ok) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: preview.error }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      ok: true,
      repoPath: preview.repoPath,
      content: preview.content,
    })
  );
};
