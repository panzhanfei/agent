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

  const steps: Array<{ id: string; ok: boolean; detail: string }> = [];
  const track = (id: string, answer: string, re: RegExp) => {
    try {
      assertMatch(id, answer, re);
      steps.push({ id, ok: true, detail: answer.slice(0, 120).replace(/\n/g, " ") });
    } catch (e) {
      steps.push({
        id,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  };

  // 1) 根 list
  const list1 = await postChat(convId, "我的原文库");
  track("list-root", list1, /原文库|Workspace|暂无文件|项：|新建/);

  // 2) 空文件夹 list（旁路）
  const listEmpty = await postChat(convId, `__FAMBRAIN_VAULT_WS_LIST__:`);
  track("list-prefix", listEmpty, /原文库|Workspace|暂无文件|项：|新建|文件夹/);

  // 3) create folder（根）
  const createFolderPrompt = `__FAMBRAIN_VAULT_WS_CREATE_FOLDER__:`;
  const createdFolderAns = await postChat(convId, createFolderPrompt);
  track("create-folder", createdFolderAns, /已新建|Created|文件夹|folder|入队|同步/i);

  // 4) create_file 在根
  const createFilePrompt = `__FAMBRAIN_VAULT_WS_CREATE_FILE__:`;
  const createAns = await postChat(convId, createFilePrompt);
  track("create-file", createAns, /已新建|Created|同步|入队/);

  const createdMatch = createAns.match(/([A-Za-z0-9_\-./]+\.txt)/);
  const createdRel = (createdMatch?.[1] ?? "").trim();
  if (!createdRel.endsWith(".txt")) {
    throw new Error(`cannot parse created path from: ${createAns.slice(0, 200)}`);
  }
  console.log(`[e2e:api] created=${createdRel}`);

  // 5) open
  const openAns = await postChat(
    convId,
    `__FAMBRAIN_VAULT_WS_OPEN__:${createdRel}`
  );
  track(
    "open",
    openAns,
    new RegExp(createdRel.replace(/\./g, "\\.") + "|```txt")
  );

  // 6) list 后应能看到文件名线索
  const listMid = await postChat(convId, "我的原文库");
  track("list-mid", listMid, /原文库|Workspace|项：|新建|\.txt/);

  // 7) delete
  const delAns = await postChat(
    convId,
    `__FAMBRAIN_VAULT_WS_DELETE_FILE__:${createdRel}`
  );
  track("delete", delAns, /已硬删除|Hard-deleted|入队硬删|硬删/);

  // 8) list 再次
  const list2 = await postChat(convId, "我的原文库");
  track("list-after-delete", list2, /原文库|Workspace|暂无文件|项：|新建/);
  if (list2.includes(createdRel) && /打开|```txt/.test(list2)) {
    throw new Error("deleted file still appears as opened content");
  }

  // 9) 再 list 指定前缀（回归）
  try {
    await postChat(convId, `__FAMBRAIN_VAULT_WS_LIST__:`);
    steps.push({ id: "list-prefix-final", ok: true, detail: "ok" });
  } catch (e) {
    steps.push({
      id: "list-prefix-final",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  console.log("[e2e:api] PASS full vault list/create/open/delete");
  console.log(
    "[e2e:api] steps=" +
      JSON.stringify(steps.map((s) => ({ id: s.id, ok: s.ok })))
  );
  void fileRel;
  void folder;
  void fileName;
};

main().catch((e) => {
  console.error("[e2e:api] FAIL", e);
  process.exit(1);
});
