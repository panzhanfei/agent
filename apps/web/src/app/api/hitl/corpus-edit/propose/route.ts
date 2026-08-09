import { getAuthSession, getAuthToken } from "@fambrain/auth";
import { resolveCorpusUserId } from "@/server/knowledge/resolve-corpus-user";
import { resolveBrainServiceUrl } from "@fambrain/brain-config/service-url";
import { forbiddenIfUntrustedMutation } from "@/lib/security/same-origin";
import { rejectIfPayloadTooLarge } from "@/lib/security/request-limits";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_JSON_BODY = 512 * 1024;

const bodySchema = z.object({
  targetPath: z.string().min(1),
  operation: z.enum(["update", "clear", "create"]),
  afterContent: z.string(),
  conversationId: z.string().min(1).optional().nullable(),
});

/** POST /api/hitl/corpus-edit/propose */
export const POST = async (req: Request) => {
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

  let rawBody: unknown = {};
  try {
    rawBody = JSON.parse((await req.text()) || "{}");
  } catch {
    return NextResponse.json({ error: "请求格式无效" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数无效", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const authToken = await getAuthToken();
  if (!authToken) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const corpusUserId = await resolveCorpusUserId(session.userId);
  const baseUrl = resolveBrainServiceUrl();
  try {
    const res = await fetch(`${baseUrl}/pipeline/corpus-edit/propose`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        ...parsed.data,
        corpusUserId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { error?: string }).error || "提案失败" },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Brain 服务不可用" }, { status: 502 });
  }
};
