/**
 * Web BFF 会话辅助：登录 → 建会话 → SSE 发消息。
 * 供 API E2E / 全链路压测复用。
 */
export type ChatSseResult = {
  answer: string;
  jobId?: string;
  paused: boolean;
  sawMainComplete: boolean;
  status: number;
  text: string;
};

export type PostChatOptions = {
  resume?: { jobId?: string; prompt?: string; name?: string };
  routingContent?: string;
  attachmentBatchId?: string;
};

export type WebSession = {
  base: string;
  postChat: (convId: string, content: string) => Promise<string>;
  postChatSse: (
    convId: string,
    content: string,
    opts?: PostChatOptions
  ) => Promise<ChatSseResult>;
  extractTextFile: (fileName: string, text: string) => Promise<string>;
  extractPdfFile: (fileName: string, pdf: Buffer) => Promise<string>;
  listMessages: (convId: string) => Promise<unknown[]>;
  createConversation: (title: string) => Promise<string>;
  jsonFetch: (
    path: string,
    init?: RequestInit
  ) => Promise<{ res: Response; body: unknown; text: string }>;
};

export const readSseAnswer = (text: string): string => readSseChat(text).answer;

export const readSseChat = (text: string): ChatSseResult => {
  let answer = "";
  let jobId: string | undefined;
  let paused = false;
  let sawMainComplete = false;
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
        jobId?: string;
        paused?: boolean;
      };
      if (ev.type === "assistant" && typeof ev.text === "string") {
        answer += ev.text;
      }
      if (ev.type === "main_turn_complete") sawMainComplete = true;
      if (typeof ev.answer === "string") answer = ev.answer;
      if (typeof ev.jobId === "string" && ev.jobId) jobId = ev.jobId;
      if (ev.type === "paused" || ev.paused) paused = true;
      if (typeof ev.error === "string") err = ev.error;
    } catch {
      /* ignore */
    }
  }
  if (!answer && err) throw new Error(`pipeline error: ${err}`);
  return { answer, jobId, paused, sawMainComplete, status: 200, text };
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
    if (
      !headers.has("Content-Type") &&
      init?.body &&
      !(init.body instanceof FormData)
    ) {
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

  const postChatSse = async (
    convId: string,
    content: string,
    opts?: PostChatOptions
  ): Promise<ChatSseResult> => {
    const resume = opts?.resume;
    const { res, text } = await jsonFetch(`/api/conversations/${convId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content,
        ...(opts?.routingContent ? { routingContent: opts.routingContent } : {}),
        ...(opts?.attachmentBatchId
          ? { attachmentBatchId: opts.attachmentBatchId }
          : {}),
        ...(resume
          ? {
              resume: {
                kind: "vault_action",
                ...(resume.jobId !== undefined ? { jobId: resume.jobId } : {}),
                ...(resume.prompt ? { prompt: resume.prompt } : {}),
                ...(resume.name ? { name: resume.name } : {}),
              },
            }
          : {}),
      }),
    });
    if (!res.ok) {
      return {
        answer: "",
        paused: false,
        sawMainComplete: false,
        status: res.status,
        text,
      };
    }
    return { ...readSseChat(text), status: res.status, text };
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

  const extractFile = async (
    fileName: string,
    bytes: Buffer,
    mimeType: string
  ): Promise<string> => {
    const form = new FormData();
    form.append(
      "files",
      new Blob([new Uint8Array(bytes)], { type: mimeType }),
      fileName
    );
    const { res, body, text: raw } = await jsonFetch("/api/documents/extract", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new Error(`extract ${res.status}: ${raw.slice(0, 400)}`);
    }
    const batchId = (body as { batchId?: string }).batchId;
    if (!batchId) {
      throw new Error(`extract missing batchId: ${raw.slice(0, 400)}`);
    }
    return batchId;
  };

  const extractTextFile = async (
    fileName: string,
    text: string
  ): Promise<string> => extractFile(fileName, Buffer.from(text, "utf8"), "text/plain");

  const extractPdfFile = async (
    fileName: string,
    pdf: Buffer
  ): Promise<string> => extractFile(fileName, pdf, "application/pdf");

  const listMessages = async (convId: string): Promise<unknown[]> => {
    const { res, body, text } = await jsonFetch(
      `/api/conversations/${convId}/messages`
    );
    if (!res.ok) {
      throw new Error(`list messages ${res.status}: ${text.slice(0, 400)}`);
    }
    if (!Array.isArray(body)) {
      throw new Error("list messages: expected array");
    }
    return body;
  };

  return {
    base,
    jsonFetch,
    createConversation,
    postChat,
    postChatSse,
    extractTextFile,
    extractPdfFile,
    listMessages,
  };
};
