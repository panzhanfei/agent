import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    getBrainServiceConfig,
    resetBrainServiceConfigCache,
} from "@fambrain/brain-config";
import { completeChat } from "./index";

const KEYS = [
    "CHAT_PROVIDER",
    "OPENAI_BASE_URL",
    "OPENAI_API_KEY",
    "DEEPSEEK_API_KEY",
    "OPENAI_MODEL",
    "OLLAMA_BASE_URL",
    "OLLAMA_HOST",
    "OLLAMA_PORT",
    "OLLAMA_MODEL",
] as const;

let snapshot: Record<string, string | undefined> = {};

beforeEach(() => {
    snapshot = {};
    for (const k of KEYS) snapshot[k] = process.env[k];
    resetBrainServiceConfigCache();
});

afterEach(() => {
    for (const k of KEYS) {
        if (snapshot[k] === undefined) delete process.env[k];
        else process.env[k] = snapshot[k];
    }
    resetBrainServiceConfigCache();
    vi.unstubAllGlobals();
});

describe("completeChat provider dispatch", () => {
    it("sends openai requests only when CHAT_PROVIDER=openai", async () => {
        process.env.CHAT_PROVIDER = "openai";
        process.env.OPENAI_API_KEY = "sk-test";
        process.env.OPENAI_BASE_URL = "https://api.deepseek.com";
        process.env.OPENAI_MODEL = "deepseek-v4-flash";
        resetBrainServiceConfigCache();
        expect(getBrainServiceConfig().chat.provider).toBe("openai");

        const fetchMock = vi.fn(async (input: RequestInfo) => {
            const url = String(input);
            if (url.includes("11434") || url.includes("/api/chat")) {
                throw new Error("must not fall back to Ollama");
            }
            return new Response(
                JSON.stringify({
                    choices: [{ message: { content: '{"ok":true}' } }],
                }),
                { status: 200 }
            );
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await completeChat({
            messages: [{ role: "user", content: "hi" }],
            jsonMode: true,
        });
        expect(result.provider).toBe("openai");
        expect(result.text).toBe('{"ok":true}');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
            "/chat/completions"
        );
    });

    it("does not call OpenAI when provider is ollama", async () => {
        process.env.CHAT_PROVIDER = "ollama";
        process.env.OLLAMA_BASE_URL = "http://127.0.0.1:11434";
        resetBrainServiceConfigCache();

        const fetchMock = vi.fn(async (input: RequestInfo) => {
            const url = String(input);
            if (url.includes("deepseek") || url.includes("/chat/completions")) {
                throw new Error("must not call OpenAI when provider=ollama");
            }
            return new Response(
                JSON.stringify({
                    message: { content: '{"ok":true}' },
                    prompt_eval_count: 3,
                    eval_count: 2,
                }),
                { status: 200 }
            );
        });
        vi.stubGlobal("fetch", fetchMock);

        const result = await completeChat({
            messages: [{ role: "user", content: "hi" }],
            jsonMode: true,
        });
        expect(result.provider).toBe("ollama");
        expect(result.text).toBe('{"ok":true}');
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/chat");
    });
});
