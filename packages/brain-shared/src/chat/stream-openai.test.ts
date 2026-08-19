import { afterEach, describe, expect, it, vi } from "vitest";
import { streamOpenAiCompatChat } from "./stream-openai";
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

describe("streamOpenAiCompatChat", () => {
    it("accumulates incremental SSE content and records usage", async () => {
        const sse = [
            'data: {"choices":[{"delta":{"content":"你好"}}]}',
            'data: {"choices":[{"delta":{"content":"世界"}}]}',
            'data: {"choices":[],"usage":{"prompt_tokens":8,"completion_tokens":2}}',
            "data: [DONE]",
            "",
        ].join("\n\n");
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(sse, { status: 200 }))
        );

        const gen = streamOpenAiCompatChat(openai, {
            messages: [{ role: "user", content: "hi" }],
            thinking: "disabled",
        });
        const texts: string[] = [];
        let usage: { prompt: number; completion: number } | undefined;
        while (true) {
            const next = await gen.next();
            if (next.done) {
                usage = next.value;
                break;
            }
            if (next.value.kind === "content") texts.push(next.value.fullText);
        }
        expect(texts.at(-1)).toBe("你好世界");
        expect(usage).toEqual({ prompt: 8, completion: 2 });
        const body = JSON.parse(
            String(
                (vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body
            )
        ) as Record<string, unknown>;
        expect(body.stream).toBe(true);
        expect(body.thinking).toEqual({ type: "disabled" });
        expect(body.stream_options).toEqual({ include_usage: true });
    });

    it("throws on HTTP error without calling Ollama", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () =>
                new Response(JSON.stringify({ error: { message: "boom" } }), {
                    status: 500,
                })
            )
        );
        const gen = streamOpenAiCompatChat(openai, {
            messages: [{ role: "user", content: "hi" }],
        });
        await expect(gen.next()).rejects.toThrow(/HTTP 500.*boom/);
    });
});
