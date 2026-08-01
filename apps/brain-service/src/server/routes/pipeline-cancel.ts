import type { IncomingMessage, ServerResponse } from "node:http";
import { abortTurn, getTurn } from "@/agentflow/execution";
import { requireAuth } from "@/server/middleware";
import { pipelineCancelBodySchema } from "@/server/schema";
import { readJsonBody } from "@/server/http";

/** POST /pipeline/cancel — 按 turnId 点名中止进行中的图执行 */
export const handlePipelineCancel = async (
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

  const parsed = pipelineCancelBodySchema.safeParse(body);
  if (!parsed.success) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: parsed.error.message }));
    return;
  }

  const { turnId, reason, conversationId } = parsed.data;
  const entry = getTurn(turnId);
  if (!entry) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, aborted: false, turnId, reason }));
    return;
  }
  if (entry.actorUserId !== userId) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "无权取消该 turn" }));
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

  const aborted = abortTurn(turnId, reason);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, aborted, turnId, reason }));
};
