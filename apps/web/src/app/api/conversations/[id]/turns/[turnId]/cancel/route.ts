import { getAuthSession, getAuthToken } from "@fambrain/auth";
import {
  cancelTurnBodySchema,
  conversationIdSchema,
  findOwnedConversation,
  turnIdParamSchema,
} from "@fambrain/db";
import { forbiddenIfUntrustedMutation } from "@/lib/security/same-origin";
import { rejectIfPayloadTooLarge } from "@/lib/security/request-limits";
import { cancelAgentPipelineTurn } from "@/server/chat/brain-service-client";
import { finalizeInflightTurnCancel } from "@/server/chat/handle-post-message";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_JSON_BODY = 4096;

/**
 * POST /api/conversations/:id/turns/:turnId/cancel
 * 显式取消（停止按钮）：Brain 任务级 abort + BFF 落库。
 * 页面刷新 / SSE 断线不会走此接口，后台仍会跑完并落库。
 */
export const POST = async (
  req: Request,
  context: {
    params: Promise<{ id: string; turnId: string }>;
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
  const parsedTurn = turnIdParamSchema.safeParse(params.turnId);
  if (!parsedId.success || !parsedTurn.success) {
    return NextResponse.json({ error: "无效会话或 turn id" }, { status: 400 });
  }

  let rawBody: unknown = {};
  try {
    rawBody = JSON.parse((await req.text()) || "{}");
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const parsedBody = cancelTurnBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsedBody.error.flatten() },
      { status: 400 }
    );
  }

  const conversationId = parsedId.data;
  const turnId = parsedTurn.data;
  const reason = parsedBody.data.reason;

  try {
    const conversation = await findOwnedConversation(
      conversationId,
      session.userId
    );
    if (!conversation) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }

    const authToken = await getAuthToken();
    if (authToken) {
      try {
        await cancelAgentPipelineTurn({
          authToken,
          turnId,
          conversationId,
          reason,
        });
      } catch (e) {
        console.error("brain cancel failed", e);
      }
    }

    const result = await finalizeInflightTurnCancel({
      turnId,
      userId: session.userId,
      conversationId,
      reason,
    });
    if (result.forbidden) {
      return NextResponse.json({ error: "无权取消该 turn" }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      turnId,
      reason,
      found: result.found,
      assistantMessage: result.assistantMessage,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "取消失败" }, { status: 500 });
  }
};
