import { getAuthSession } from "@fambrain/auth";
import { conversationIdSchema, patchConversationSchema } from "@fambrain/db";
import { forbiddenIfUntrustedMutation } from "@/lib/security/same-origin";
import { rejectIfPayloadTooLarge } from "@/lib/security/request-limits";
import {
  deleteOwnedConversationForUser,
  patchOwnedConversation,
} from "@/server/conversations";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_JSON_BODY = 8192;

export const PATCH = async (
  req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
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
  const rawId = (await context.params).id;
  const parsedId = conversationIdSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "无效会话 id" }, { status: 400 });
  }
  let rawBody: unknown;
  try {
    rawBody = JSON.parse((await req.text()) || "{}");
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const parsed = patchConversationSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const updated = await patchOwnedConversation({
      conversationId: parsedId.data,
      userId: session.userId,
      title: parsed.data.title,
      pinned: parsed.data.pinned,
    });
    if (!updated) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "更新会话失败" }, { status: 500 });
  }
};

export const DELETE = async (
  req: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) => {
  const untrusted = forbiddenIfUntrustedMutation(req);
  if (untrusted) return untrusted;
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
  const rawId = (await context.params).id;
  const parsedId = conversationIdSchema.safeParse(rawId);
  if (!parsedId.success) {
    return NextResponse.json({ error: "无效会话 id" }, { status: 400 });
  }
  try {
    const deleted = await deleteOwnedConversationForUser(
      parsedId.data,
      session.userId
    );
    if (!deleted) {
      return NextResponse.json({ error: "会话不存在" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "删除会话失败" }, { status: 500 });
  }
};
