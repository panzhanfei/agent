import type { IncomingMessage, ServerResponse } from "node:http";
import { getTurn, requestTurnPause } from "@/agentflow/execution";
import { requireAuth } from "@/server/middleware";
import { pipelinePauseBodySchema } from "@/server/schema";
import { readJsonBody } from "@/server/http";

/** POST /pipeline/pause — 请求停止生成（半截稿即终稿，随后 discard；不 abort SSE） */
export const handlePipelinePause = async (
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

  const parsed = pipelinePauseBodySchema.safeParse(body);
  if (!parsed.success) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: parsed.error.message }));
    return;
  }

  const { turnId, conversationId } = parsed.data;
  const entry = getTurn(turnId);
  if (!entry) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, paused: false, turnId }));
    return;
  }
  if (entry.actorUserId !== userId) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "无权暂停该 turn" }));
    return;
  }
  if (
    conversationId &&
    entry.conversationId &&
    entry.conversationId !== conversationId
  ) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "turn 与会话不匹配" }));
    return;
  }

  const paused = requestTurnPause(turnId);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, paused, turnId }));
};
