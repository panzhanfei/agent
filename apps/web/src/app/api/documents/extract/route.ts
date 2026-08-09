import { getAuthSession, getAuthToken } from "@fambrain/auth";
import { resolveBrainServiceUrl } from "@fambrain/brain-config/service-url";
import { forbiddenIfUntrustedMutation } from "@/lib/security/same-origin";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 128 * 1024 * 1024;

/**
 * POST /api/documents/extract — 聊天附件：仅抽取文本并暂存，不入库。
 */
export const POST = async (req: Request) => {
  const untrusted = forbiddenIfUntrustedMutation(req);
  if (untrusted) return untrusted;

  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const n = Number.parseInt(contentLength, 10);
    if (Number.isFinite(n) && n > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "上传总大小超限" }, { status: 413 });
    }
  }

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
  const authToken = await getAuthToken();
  if (!authToken) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const incoming = await req.formData();
  const outbound = new FormData();
  let fileCount = 0;
  for (const [key, value] of incoming.entries()) {
    if (!(value instanceof File) || value.size === 0) continue;
    outbound.append(key, value, value.name);
    fileCount += 1;
  }
  if (fileCount === 0) {
    return NextResponse.json({ error: "请至少上传 1 个文件" }, { status: 400 });
  }

  const baseUrl = resolveBrainServiceUrl();
  const res = await fetch(`${baseUrl}/documents/extract`, {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}` },
    body: outbound,
  });
  const text = await res.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = {
      error: text || `Brain 服务失败（HTTP ${res.status}）`,
    };
  }
  return NextResponse.json(payload, { status: res.status });
};
