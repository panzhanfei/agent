import { getAuthSession, getAuthToken } from "@fambrain/auth";
import { resolveCorpusUserId } from "@/server/knowledge/resolve-corpus-user";
import { resolveBrainServiceUrl } from "@fambrain/brain-config/service-url";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** GET /api/hitl/corpus-edit/content?targetPath= */
export const GET = async (req: Request) => {
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

  const url = new URL(req.url);
  const targetPath = url.searchParams.get("targetPath")?.trim() ?? "";
  if (!targetPath) {
    return NextResponse.json({ error: "缺少 targetPath" }, { status: 400 });
  }

  const authToken = await getAuthToken();
  if (!authToken) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const corpusUserId = await resolveCorpusUserId(session.userId);
  const baseUrl = resolveBrainServiceUrl();
  const qs = new URLSearchParams({ targetPath, corpusUserId });
  try {
    const res = await fetch(`${baseUrl}/pipeline/corpus-edit/content?${qs}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { error?: string }).error || "加载失败" },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Brain 服务不可用" }, { status: 502 });
  }
};
