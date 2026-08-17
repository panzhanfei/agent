import { getAuthSession } from "@fambrain/auth";
import { createConversationSchema } from "@fambrain/db";
import { forbiddenIfUntrustedMutation } from "@/lib/security/same-origin";
import { rejectIfPayloadTooLarge } from "@/lib/security/request-limits";
import {
  createOwnedConversation,
  listSidebarConversations,
} from "@/server/conversations";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_JSON_BODY = 8192;

export const GET = async () => {
  try {
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
    const body = await listSidebarConversations(session.userId);
    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "加载对话列表失败" }, { status: 500 });
  }
};

export const POST = async (req: Request) => {
  const untrusted = forbiddenIfUntrustedMutation(req);
  if (untrusted) return untrusted;
  const oversized = rejectIfPayloadTooLarge(req, MAX_JSON_BODY);
  if (oversized) return oversized;
  try {
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
    let raw: unknown;
    try {
      raw = JSON.parse((await req.text()) || "{}");
    } catch {
      return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
    }
    const parsed = createConversationSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "参数无效", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const created = await createOwnedConversation({
      userId: session.userId,
      title: parsed.data.title,
    });
    return NextResponse.json(created);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "创建会话失败" }, { status: 500 });
  }
};
