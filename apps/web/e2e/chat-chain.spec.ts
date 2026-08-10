import { expect, test } from "@playwright/test";

const user = process.env.E2E_USER ?? "panzhanfei";
const password = process.env.E2E_PASSWORD ?? "12345678";

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

test.describe("chat dialogue chain", () => {
  test("login → 姓名 → 年龄 → 手机（对话主链）", async ({ page, baseURL }) => {
    test.setTimeout(300_000);
    const origin = baseURL ?? "http://127.0.0.1:3000";
    const stamp = Date.now().toString(36);
    const title = `pw-chat-${stamp}`;

    const loginRes = await page.request.post("/api/auth/login", {
      data: { username: user, password },
      headers: { Origin: origin },
    });
    expect(loginRes.ok(), await loginRes.text()).toBeTruthy();

    const convRes = await page.request.post("/api/conversations", {
      data: { title },
      headers: { Origin: origin },
    });
    expect(convRes.ok(), await convRes.text()).toBeTruthy();
    const conv = (await convRes.json()) as { id: string };

    const ask = async (content: string): Promise<string> => {
      const msgRes = await page.request.post(
        `/api/conversations/${conv.id}/messages`,
        {
          data: { content },
          headers: { Origin: origin },
        }
      );
      expect(msgRes.ok(), await msgRes.text()).toBeTruthy();
      return readSseAnswer(await msgRes.text());
    };

    const nameAns = await ask("我的名字是什么？");
    expect(nameAns).toMatch(/潘展飞/);

    const ageAns = await ask("我今年多大？");
    expect(ageAns).toMatch(/\d{2}|岁|1993/);

    const phoneAns = await ask("我的手机号多少？");
    expect(phoneAns).toMatch(/13679383435/);

    await page.goto("/");
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 30_000 });
    await page.getByText(title).first().click();
    await expect(page.getByText(/潘展飞/).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
