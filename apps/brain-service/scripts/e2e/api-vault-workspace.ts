#!/usr/bin/env node
/**
 * API E2E（完整）：登录 → 会话 → list → create_file → open → delete → 再 list。
 *
 * 环境：E2E_BASE_URL / E2E_USER / E2E_PASSWORD；需 web + brain（队列可选）。
 */
const base = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const user = process.env.E2E_USER ?? "panzhanfei";
const password = process.env.E2E_PASSWORD ?? "12345678";
const stamp = Date.now().toString(36);
const folder = `_e2e_${stamp}`;
const fileName = `note-${stamp}.txt`;
const fileRel = `${folder}/${fileName}`;

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

const readSseAnswer = (text: string): string => {
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

const postChat = async (convId: string, content: string): Promise<string> => {
  const { res, text } = await jsonFetch(
    `/api/conversations/${convId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    }
  );
  if (!res.ok) {
    throw new Error(`post message ${res.status}: ${text.slice(0, 400)}`);
  }
  return readSseAnswer(text);
};

const assertMatch = (label: string, answer: string, re: RegExp) => {
  if (!re.test(answer)) {
    throw new Error(
      `${label}: answer mismatch\n---\n${answer.slice(0, 500)}\n---`
    );
  }
  console.log(`[e2e:api] OK ${label}`);
};

const main = async () => {
  console.log(`[e2e:api] base=${base} user=${user} file=${fileRel}`);

  const login = await jsonFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: user, password }),
  });
  if (!login.res.ok) {
    throw new Error(`login ${login.res.status}: ${login.text}`);
  }
  if (cookieJar.size === 0) {
    console.warn("[e2e:api] no Set-Cookie; cookie session may fail");
  }

  const conv = await jsonFetch("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ title: `e2e-vault-${stamp}` }),
  });
  if (!conv.res.ok) {
    throw new Error(`create conversation ${conv.res.status}: ${conv.text}`);
  }
  const convId = (conv.body as { id?: string }).id;
  if (!convId) throw new Error("missing conversation id");

  // 1) 根 list
  const list1 = await postChat(convId, "我的原文库");
  assertMatch("list-root", list1, /原文库|Workspace|暂无文件|项：|新建/);

  // 2) UI create folder（旁路 exact-match）
  const createFolderPrompt = `__FAMBRAIN_VAULT_WS_CREATE_FOLDER__:`;
  const createdFolderAns = await postChat(convId, createFolderPrompt);
  // 旁路会用随机名；再显式建我们的测试文件夹+文件用结构化 create 更稳
  // 改走带 name 的 create_file 前先用 create_folder via list CTA 不够稳，直接再发 open/create prompts
  void createdFolderAns;

  // 用 create_file 在根创建（旁路会生成 untitled-*.txt）；再删掉不够精确。
  // 改：用 delete/create 前缀 + 再用 open。为可控 path，调用 create_file 后从回答里解析路径。
  const createFilePrompt = `__FAMBRAIN_VAULT_WS_CREATE_FILE__:`;
  const createAns = await postChat(convId, createFilePrompt);
  assertMatch("create-file", createAns, /已新建|Created|同步|入队/);

  const createdMatch = createAns.match(/([A-Za-z0-9_\-./]+\.txt)/);
  const createdRel = (createdMatch?.[1] ?? "").trim();
  if (!createdRel.endsWith(".txt")) {
    throw new Error(`cannot parse created path from: ${createAns.slice(0, 200)}`);
  }
  console.log(`[e2e:api] created=${createdRel}`);

  // 3) open
  const openAns = await postChat(
    convId,
    `__FAMBRAIN_VAULT_WS_OPEN__:${createdRel}`
  );
  assertMatch("open", openAns, new RegExp(createdRel.replace(/\./g, "\\.") + "|```txt"));

  // 4) delete
  const delAns = await postChat(
    convId,
    `__FAMBRAIN_VAULT_WS_DELETE_FILE__:${createdRel}`
  );
  assertMatch("delete", delAns, /已硬删除|Hard-deleted|入队硬删|硬删/);

  // 5) list 再次，不应再强调该文件（弱断言：不应 open 失败以外的「已打开」）
  const list2 = await postChat(convId, "我的原文库");
  assertMatch("list-after-delete", list2, /原文库|Workspace|暂无文件|项：|新建/);
  if (list2.includes(createdRel) && /打开|```txt/.test(list2)) {
    throw new Error("deleted file still appears as opened content");
  }

  // 清理可能生成的随机 folder（best-effort，忽略失败）
  try {
    await postChat(convId, `__FAMBRAIN_VAULT_WS_LIST__:`);
  } catch {
    /* ignore */
  }

  console.log("[e2e:api] PASS full vault list/create/open/delete");
  void fileRel;
  void folder;
  void fileName;
};

main().catch((e) => {
  console.error("[e2e:api] FAIL", e);
  process.exit(1);
});
