import { afterEach, describe, expect, it, vi } from "vitest";
import { completeOpenAiCompatChat } from "./openai-compat";
import type { OpenAiCompatChatConfig } from "@fambrain/brain-config";

const openai: OpenAiCompatChatConfig = {
    baseUrl: "https://api.deepseek.com",
    chatCompletionsUrl: "https://api.deepseek.com/chat/completions",
    apiKey: "sk-test",
    model: "deepseek-v4-flash",
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("completeOpenAiCompatChat", () => {
    it("disables thinking and requests json_object", async () => {
        const fetchMock = vi.fn(async () =>
            new Response(
                JSON.stringify({
                    model: "deepseek-v4-flash",
                    choices: [
                        { message: { content: '{"intent":"clarify"}' } },
                    ],
                    usage: { prompt_tokens: 10, completion_tokens: 4 },
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            )
        );
        vi.stubGlobal("fetch", fetchMock);

        const result = await completeOpenAiCompatChat(openai, {
            messages: [{ role: "user", content: "hi" }],
            jsonMode: true,
            thinking: "disabled",
        });

        expect(result.text).toBe('{"intent":"clarify"}');
        expect(result.provider).toBe("openai");
        expect(result.usage).toEqual({ prompt: 10, completion: 4 });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(openai.chatCompletionsUrl);
        expect((init.headers as Record<string, string>).Authorization).toBe(
            "Bearer sk-test"
        );
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(body.thinking).toEqual({ type: "disabled" });
        expect(body.response_format).toEqual({ type: "json_object" });
        expect(body.temperature).toBe(0);
        expect(body.stream).toBe(false);
        expect(body.model).toBe("deepseek-v4-flash");
    });

    it("passes temperature and omits json_object for prose calls", async () => {
        const fetchMock = vi.fn(async () =>
            new Response(
                JSON.stringify({
                    choices: [{ message: { content: "会话摘要：用户用 React。" } }],
                }),
                { status: 200 }
            )
        );
        vi.stubGlobal("fetch", fetchMock);

        const result = await completeOpenAiCompatChat(openai, {
            messages: [{ role: "user", content: "请摘要" }],
            jsonMode: false,
            thinking: "disabled",
            temperature: 0.2,
        });
        expect(result.text).toContain("React");
        const body = JSON.parse(
            String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)
        ) as Record<string, unknown>;
        expect(body.temperature).toBe(0.2);
        expect(body.response_format).toBeUndefined();
        expect(body.thinking).toEqual({ type: "disabled" });
    });

    it("throws on HTTP error and does not swallow the body", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                new Response(
                    JSON.stringify({ error: { message: "Insufficient Balance" } }),
                    { status: 402 }
                )
            )
        );
        await expect(
            completeOpenAiCompatChat(openai, {
                messages: [{ role: "user", content: "hi" }],
            })
        ).rejects.toThrow(/HTTP 402.*Insufficient Balance/);
    });

    it("throws when assistant content is empty", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                new Response(
                    JSON.stringify({ choices: [{ message: { content: "" } }] }),
                    { status: 200 }
                )
            )
        );
        await expect(
            completeOpenAiCompatChat(openai, {
                messages: [{ role: "user", content: "hi" }],
            })
        ).rejects.toThrow(/未返回助手文本/);
    });
});
