/**
 * 有道智云文本翻译 NMT（openapi.youdao.com）。
 * 签名：sha256(appKey + truncate(q) + salt + curtime + appSecret)
 */
import { createHash, randomUUID } from "node:crypto";

const YOUDAO_API = "https://openapi.youdao.com/api";

const truncateForSign = (q: string): string => {
  const len = [...q].length;
  if (len <= 20) return q;
  const chars = [...q];
  return `${chars.slice(0, 10).join("")}${len}${chars.slice(-10).join("")}`;
};

const buildSign = (input: {
  appKey: string;
  appSecret: string;
  q: string;
  salt: string;
  curtime: string;
}): string => {
  const raw =
    input.appKey +
    truncateForSign(input.q) +
    input.salt +
    input.curtime +
    input.appSecret;
  return createHash("sha256").update(raw, "utf8").digest("hex");
};

export type YoudaoTranslateInput = {
  appKey: string;
  appSecret: string;
  q: string;
  from: string;
  to: string;
};

export type YoudaoTranslateOk = {
  ok: true;
  translation: string;
};

export type YoudaoTranslateErr = {
  ok: false;
  message: string;
};

export const translateWithYoudao = async (
  input: YoudaoTranslateInput
): Promise<YoudaoTranslateOk | YoudaoTranslateErr> => {
  const salt = randomUUID();
  const curtime = String(Math.floor(Date.now() / 1000));
  const sign = buildSign({
    appKey: input.appKey,
    appSecret: input.appSecret,
    q: input.q,
    salt,
    curtime,
  });
  const body = new URLSearchParams({
    q: input.q,
    from: input.from,
    to: input.to,
    appKey: input.appKey,
    salt,
    sign,
    signType: "v3",
    curtime,
  });

  const res = await fetch(YOUDAO_API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    return { ok: false, message: `Youdao HTTP ${res.status}` };
  }
  const json = (await res.json()) as {
    errorCode?: string;
    translation?: string[];
    msg?: string;
  };
  if (String(json.errorCode ?? "0") !== "0") {
    return {
      ok: false,
      message: `Youdao errorCode=${json.errorCode}${
        json.msg ? ` ${json.msg}` : ""
      }`,
    };
  }
  const translation = (json.translation ?? []).join("\n").trim();
  if (!translation) {
    return { ok: false, message: "Youdao returned empty translation" };
  }
  return { ok: true, translation };
};

export const readYoudaoCredentials = (): {
  appKey: string;
  appSecret: string;
} | null => {
  const appKey =
    process.env.YOUDAO_APP_KEY?.trim() ||
    process.env.FAMBRAIN_YOUDAO_APP_KEY?.trim();
  const appSecret =
    process.env.YOUDAO_APP_SECRET?.trim() ||
    process.env.FAMBRAIN_YOUDAO_APP_SECRET?.trim();
  if (!appKey || !appSecret) return null;
  return { appKey, appSecret };
};

/** provider=youdao（默认）或显式有凭证 */
export const isYoudaoTranslateConfigured = (): boolean => {
  const provider = (
    process.env.FAMBRAIN_TRANSLATE_PROVIDER ?? "youdao"
  ).trim().toLowerCase();
  if (provider && provider !== "youdao") return false;
  return Boolean(readYoudaoCredentials());
};
