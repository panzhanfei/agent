import { getAuthSession } from "@fambrain/auth";
import { forbiddenIfUntrustedMutation } from "@/lib/security/same-origin";
import { rejectIfPayloadTooLarge } from "@/lib/security/request-limits";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_JSON_BODY = 512 * 1024;

/** POST /api/hitl/corpus-edit/propose — 已退役（请走原文库 vault txt） */
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

  return NextResponse.json(
    {
      error:
        "已不再支持直接修订语料 Markdown。请打开「我的原文库」编辑 .txt（会自动语料化）。",
      code: "corpus_md_hitl_retired",
    },
    { status: 410 }
  );
};
