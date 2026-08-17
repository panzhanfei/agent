import { getAuthSession, getAuthToken } from "@fambrain/auth";
import { conversationIdSchema, turnIdParamSchema } from "@fambrain/db";
import { forbiddenIfUntrustedMutation } from "@/lib/security/same-origin";
import { rejectIfPayloadTooLarge } from "@/lib/security/request-limits";
import { pauseAgentPipelineTurn } from "@/server/chat";
import { requireOwnedConversation } from "@/server/conversations";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_JSON_BODY = 4096;

/**
 * POST /api/conversations/:id/turns/:turnId/pause
 * 请求停止生成（半截稿落库为终稿，discard 图任务；不 abort SSE）。
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

  const conversationId = parsedId.data;
  const turnId = parsedTurn.data;

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

    const result = await pauseAgentPipelineTurn({
      authToken,
      turnId,
      conversationId,
    });
    return NextResponse.json({
      ok: true,
      turnId,
      paused: result.paused,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "暂停失败" }, { status: 500 });
  }
};
