/**
 * Web BFF 会话辅助：登录 → 建会话 → SSE 发消息。
 * 供 API E2E / 全链路压测复用。
 */
export type WebSession = {
  base: string;
  postChat: (convId: string, content: string) => Promise<string>;
  createConversation: (title: string) => Promise<string>;
  jsonFetch: (
    path: string,
    init?: RequestInit
  ) => Promise<{ res: Response; body: unknown; text: string }>;
};

export const readSseAnswer = (text: string): string => {
  let answer = "";
  let err: string | null = null;
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const ev = JSON.parse(payload) as {
        type?: string;
        text?: string;
        answer?: string;
        error?: string;
      };
      if (ev.type === "assistant" && typeof ev.text === "string") {
        answer += ev.text;
      }
      if (typeof ev.answer === "string") answer = ev.answer;
      if (typeof ev.error === "string") err = ev.error;
    } catch {
      /* ignore */
    }
  }
  if (!answer && err) throw new Error(`pipeline error: ${err}`);
  return answer;
};

export const createWebSession = async (opts?: {
  base?: string;
  user?: string;
  password?: string;
}): Promise<WebSession> => {
  const base = (opts?.base ?? process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").replace(
    /\/$/,
    ""
  );
  const user = opts?.user ?? process.env.E2E_USER ?? "panzhanfei";
  const password = opts?.password ?? process.env.E2E_PASSWORD ?? "12345678";
  const cookieJar = new Map<string, string>();

  const storeCookies = (res: Response) => {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const part = line.split(";")[0] ?? "";
      const eq = part.indexOf("=");
      if (eq > 0) cookieJar.set(part.slice(0, eq), part.slice(eq + 1));
    }
  };

  const cookieHeader = (): string =>
    [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const jsonFetch = async (
    path: string,
    init?: RequestInit
  ): Promise<{ res: Response; body: unknown; text: string }> => {
    const headers = new Headers(init?.headers);
    if (!headers.has("Content-Type") && init?.body) {
      headers.set("Content-Type", "application/json");
    }
    const c = cookieHeader();
    if (c) headers.set("Cookie", c);
    if (!headers.has("Origin")) headers.set("Origin", base);
    const res = await fetch(`${base}${path}`, { ...init, headers });
    storeCookies(res);
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* keep text */
    }
    return { res, body, text };
  };

  const login = await jsonFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: user, password }),
  });
  if (!login.res.ok) {
    throw new Error(`login ${login.res.status}: ${login.text}`);
  }

  const createConversation = async (title: string): Promise<string> => {
    const conv = await jsonFetch("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    if (!conv.res.ok) {
      throw new Error(`create conversation ${conv.res.status}: ${conv.text}`);
    }
    const convId = (conv.body as { id?: string }).id;
    if (!convId) throw new Error("missing conversation id");
    return convId;
  };

  const postChat = async (convId: string, content: string): Promise<string> => {
    const { res, text } = await jsonFetch(`/api/conversations/${convId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      throw new Error(`post message ${res.status}: ${text.slice(0, 400)}`);
    }
    return readSseAnswer(text);
  };

  return { base, jsonFetch, createConversation, postChat };
};
