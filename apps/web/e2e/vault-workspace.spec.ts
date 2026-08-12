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
        error?: string;
      };
      if (ev.type === "assistant" && typeof ev.text === "string") {
        answer += ev.text;
      }
      if (typeof ev.error === "string") err = ev.error;
    } catch {
      /* ignore */
    }
  }
  if (!answer && err) throw new Error(`pipeline error: ${err}`);
  return answer;
};

test.describe("vault workspace UI", () => {
  test("login → list → 点击新建 txt → 删除", async ({ page, baseURL }) => {
    const origin = baseURL ?? "http://127.0.0.1:3000";
    const stamp = Date.now().toString(36);
    const title = `pw-vault-${stamp}`;

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

    const msgRes = await page.request.post(
      `/api/conversations/${conv.id}/messages`,
      {
        data: { content: "我的原文库" },
        headers: { Origin: origin },
      }
    );
    expect(msgRes.ok()).toBeTruthy();
    const answer = readSseAnswer(await msgRes.text());
    expect(answer.length).toBeGreaterThan(0);

    await page.goto("/");
    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.getByText(title).first().click();
    await expect(page.getByRole("button", { name: "日志" })).toBeEnabled({
      timeout: 20_000,
    });
    await expect(page.getByText("我的原文库").first()).toBeVisible({
      timeout: 20_000,
    });

    // 点「新建 txt」：旧消息按钮会 stale；新回复 blocks 含「已新建」+ 可点删除
    await page
      .getByRole("button", { name: /新建 txt/i, disabled: false })
      .last()
      .click();
    await expect(
      page.getByText(/已新建|Created|同步|入队/i).first()
    ).toBeVisible({ timeout: 90_000 });

    const deleteBtn = page
      .getByRole("button", { name: /删除 .+\.txt/i, disabled: false })
      .last();
    await expect(deleteBtn).toBeEnabled({ timeout: 90_000 });
    await deleteBtn.click();
    await expect(
      page.getByText(/已硬删除|Hard-deleted|入队硬删/i).first()
    ).toBeVisible({ timeout: 90_000 });
  });
});
