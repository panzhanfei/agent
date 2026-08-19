import { expect, test } from "@playwright/test";
import { makeEvalMemoPdf } from "./eval-memo-pdf";

const user = process.env.E2E_USER ?? "panzhanfei";
const password = process.env.E2E_PASSWORD ?? "12345678";

const readSse = (
  text: string
): { answer: string; paused: boolean; jobId?: string } => {
  let answer = "";
  let paused = false;
  let jobId: string | undefined;
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
      if (typeof ev.answer === "string") answer = ev.answer;
      if (typeof ev.jobId === "string" && ev.jobId) jobId = ev.jobId;
      if (ev.type === "paused" || ev.paused) paused = true;
      if (typeof ev.error === "string") err = ev.error;
    } catch {
      /* ignore */
    }
  }
  if (!answer && err) throw new Error(`pipeline error: ${err}`);
  return { answer, paused, jobId };
};

test.describe("vault save-offer UI", () => {
  test("确定入库弹窗可关闭；取消入库结束任务", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(300_000);
    const origin = baseURL ?? "http://127.0.0.1:3000";
    const stamp = Date.now().toString(36);
    const title = `pw-save-${stamp}`;

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

    const extractRes = await page.request.post("/api/documents/extract", {
      multipart: {
        files: {
          name: "eval-memo.pdf",
          mimeType: "application/pdf",
          buffer: makeEvalMemoPdf(),
        },
      },
      headers: { Origin: origin },
    });
    expect(extractRes.ok(), await extractRes.text()).toBeTruthy();
    const extracted = (await extractRes.json()) as { batchId?: string };
    expect(extracted.batchId).toBeTruthy();

    const msgRes = await page.request.post(
      `/api/conversations/${conv.id}/messages`,
      {
        data: {
          content: "请总结这个附件",
          attachmentBatchId: extracted.batchId,
        },
        headers: { Origin: origin },
      }
    );
    expect(msgRes.ok(), await msgRes.text()).toBeTruthy();
    const sse = readSse(await msgRes.text());
    expect(sse.paused, sse.answer.slice(0, 200)).toBeTruthy();
    expect(sse.jobId).toBeTruthy();
    expect(sse.answer).toMatch(/确定入库|写入原文库|Save/);

    await page.goto("/");
    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.getByText(title).first().click();
    await expect(
      page.getByRole("button", { name: /确定入库|Save/i, disabled: false }).last()
    ).toBeVisible({ timeout: 30_000 });

    await page
      .getByRole("button", { name: /确定入库|Save/i, disabled: false })
      .last()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "写入原文库" })
    ).toBeVisible();

    await page.getByRole("button", { name: "关闭" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page
      .getByRole("button", { name: "取消", disabled: false })
      .last()
      .click();
    await expect(
      page.getByRole("button", { name: "确定入库", disabled: true }).last()
    ).toBeVisible({ timeout: 90_000 });
  });
});
