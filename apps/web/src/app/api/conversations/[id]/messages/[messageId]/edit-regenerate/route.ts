import { getAuthSession, getAuthToken } from "@fambrain/auth";
import {
  conversationIdSchema,
  editRegenerateMessageBodySchema,
} from "@fambrain/db";
import { forbiddenIfUntrustedMutation } from "@/lib/security/same-origin";
import { rejectIfPayloadTooLarge } from "@/lib/security/request-limits";
import {
  cancelAgentPipelineTurn,
  createPostMessageStreamResponse,
  finalizeInflightTurnCancel,
  findInflightTurnByConversation,
} from "@/server/chat";
import {
  editUserMessageAndTruncateAfter,
  listModelHistory,
  requireOwnedConversation,
} from "@/server/conversations";
import { resolveCorpusUserId } from "@/server/knowledge";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_JSON_BODY = 221184;
const messageIdSchema = z.string().cuid();

/**
 * POST /api/conversations/:id/messages/:messageId/edit-regenerate
 * 原地改用户气泡 → 截断后续 → supersede 进行中 turn → 流式重跑（不重复 append user）
 */
export const POST = async (
  req: Request,
  context: {
    params: Promise<{ id: string; messageId: string }>;
  }
) => {
  const untrusted = forbiddenIfUntrustedMutation(req);
  if (untrusted) return untrusted;
  const oversized = rejectIfPayloadTooLarge(req, MAX_JSON_BODY);
  if (oversized) return oversized;

  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (session.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "账号待审核或未通过审核" },
      { status: 403 }
    );
  }

  const params = await context.params;
  const parsedId = conversationIdSchema.safeParse(params.id);
  const parsedMsg = messageIdSchema.safeParse(params.messageId);
  if (!parsedId.success || !parsedMsg.success) {
    return NextResponse.json({ error: "无效会话或消息 id" }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse((await req.text()) || "{}");
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const parsedBody = editRegenerateMessageBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  const conversationId = parsedId.data;
  const messageId = parsedMsg.data;
  const content = parsedBody.data.content.trim();
  const turnId = parsedBody.data.turnId ?? crypto.randomUUID();

  try {
    const conversation = await requireOwnedConversation(
      conversationId,
      session.userId
    );
    if (!conversation) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    const authToken = await getAuthToken();
    if (!authToken) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const inflight = findInflightTurnByConversation(
      conversationId,
      session.userId
    );
    if (inflight) {
      try {
        await cancelAgentPipelineTurn({
          authToken,
          turnId: inflight.turnId,
          conversationId,
          reason: "superseded",
        });
      } catch (e) {
        console.error("brain cancel on edit-regenerate failed", e);
      }
      await finalizeInflightTurnCancel({
        turnId: inflight.turnId,
        userId: session.userId,
        conversationId,
        reason: "superseded",
      });
    }

    const edited = await editUserMessageAndTruncateAfter({
      conversationId,
      userId: session.userId,
      messageId,
      content,
    });
    if (!edited.ok) {
      const status =
        edited.error === "forbidden"
          ? 403
          : edited.error === "not_user_message"
            ? 400
            : 404;
      const msg =
        edited.error === "not_user_message"
          ? "只能编辑用户消息"
          : edited.error === "forbidden"
            ? "无权操作"
            : "消息不存在";
      return NextResponse.json({ error: msg }, { status });
    }

    const history = await listModelHistory(conversationId);
    const corpusUserId = await resolveCorpusUserId(session.userId);

    return createPostMessageStreamResponse({
      conversationId,
      userContent: edited.message.content,
      pipelineContent: edited.message.content,
      conversationTitle: conversation.title,
      history,
      authToken,
      turnId,
      existingUserMessageId: edited.message.id,
      pipelineContext: {
        actorUserId: session.userId,
        corpusUserId,
        displayName: session.displayName,
        conversationId,
        turnId,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "编辑重跑失败" }, { status: 500 });
  }
};
