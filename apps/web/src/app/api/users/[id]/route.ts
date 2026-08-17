import { getAuthSession } from "@fambrain/auth";
import { forbiddenIfUntrustedMutation } from "@/lib/security/same-origin";
import { deleteMember, patchMemberStatus } from "@/server/users";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const patchBodySchema = z.object({
  status: z.enum(["ACTIVE", "REJECTED"]),
});

type RouteCtx = {
  params: Promise<{
    id: string;
  }>;
};

export const PATCH = async (req: Request, ctx: RouteCtx) => {
  const untrusted = forbiddenIfUntrustedMutation(req);
  if (untrusted) return untrusted;
  const admin = await getAuthSession();
  if (!admin) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (!admin.canManageMembers) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体必须为 JSON" }, { status: 400 });
  }
  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "无效的状态值" }, { status: 400 });
  }
  const result = await patchMemberStatus({
    actorUserId: admin.userId,
    targetId: id,
    status: parsed.data.status,
  });
  if (!result.ok) {
    if (result.code === "not_found") {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "无法将自己标记为拒绝" },
      { status: 400 }
    );
  }
  return NextResponse.json(result.user);
};

export const DELETE = async (req: Request, ctx: RouteCtx) => {
  const untrusted = forbiddenIfUntrustedMutation(req);
  if (untrusted) return untrusted;
  const actor = await getAuthSession();
  if (!actor) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (!actor.canManageMembers) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const result = await deleteMember({
    actorUserId: actor.userId,
    targetId: id,
  });
  if (!result.ok) {
    if (result.code === "self_delete") {
      return NextResponse.json(
        { error: "不能删除当前登录账号" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
};
