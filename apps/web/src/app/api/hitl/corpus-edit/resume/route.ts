import { getAuthSession, getAuthToken } from "@fambrain/auth";
import { forbiddenIfUntrustedMutation } from "@/lib/security/same-origin";
import { rejectIfPayloadTooLarge } from "@/lib/security/request-limits";
import { resumeCorpusEditProposal } from "@/server/chat/brain-service-client";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const MAX_JSON_BODY = 8192;

const bodySchema = z.object({
  proposalId: z.string().min(1),
  action: z.enum(["approve", "reject", "detail"]),
});

/** POST /api/hitl/corpus-edit/resume — 代理 Brain HITL 确认 */
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

  try {
    const data = await resumeCorpusEditProposal({
      authToken,
      proposalId: parsed.data.proposalId,
      action: parsed.data.action,
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "resume failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
};
