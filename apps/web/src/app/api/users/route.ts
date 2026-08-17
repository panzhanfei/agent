import { getAuthSession } from "@fambrain/auth";
import { listAdminMembers } from "@/server/users";
import { NextResponse } from "next/server";

export const GET = async () => {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  if (!session.canManageMembers) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const users = await listAdminMembers();
  return NextResponse.json(users);
};
