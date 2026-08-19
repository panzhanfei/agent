import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    formatChatProviderStartupLine,
    getBrainServiceConfig,
    resetBrainServiceConfigCache,
    resolveOpenAiChatCompletionsUrl,
} from "./index";

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
    "OLLAMA_MODEL_INTAKE_COORDINATOR",
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
});

describe("resolveOpenAiChatCompletionsUrl", () => {
    it("appends /chat/completions to DeepSeek root", () => {
        expect(resolveOpenAiChatCompletionsUrl("https://api.deepseek.com")).toBe(
            "https://api.deepseek.com/chat/completions"
        );
    });

    it("keeps /v1 prefix for OpenAI-style bases", () => {
        expect(resolveOpenAiChatCompletionsUrl("https://api.openai.com/v1/")).toBe(
            "https://api.openai.com/v1/chat/completions"
        );
    });

    it("does not double-append if already complete", () => {
        expect(
            resolveOpenAiChatCompletionsUrl(
                "https://api.deepseek.com/chat/completions"
            )
        ).toBe("https://api.deepseek.com/chat/completions");
    });
});

describe("getBrainServiceConfig chat provider", () => {
    it("defaults to ollama and leaves openai null", () => {
        delete process.env.CHAT_PROVIDER;
        delete process.env.OPENAI_API_KEY;
        delete process.env.DEEPSEEK_API_KEY;
        const cfg = getBrainServiceConfig();
        expect(cfg.chat.provider).toBe("ollama");
        expect(cfg.chat.openai).toBeNull();
    });

    it("requires an API key when provider is openai", () => {
        process.env.CHAT_PROVIDER = "openai";
        delete process.env.OPENAI_API_KEY;
        delete process.env.DEEPSEEK_API_KEY;
        expect(() => getBrainServiceConfig()).toThrow(/OPENAI_API_KEY|DEEPSEEK_API_KEY/);
    });

    it("accepts DEEPSEEK_API_KEY and defaults Flash model", () => {
        process.env.CHAT_PROVIDER = "openai";
        delete process.env.OPENAI_API_KEY;
        process.env.DEEPSEEK_API_KEY = "sk-test-deepseek";
        delete process.env.OPENAI_MODEL;
        delete process.env.OPENAI_BASE_URL;
        const cfg = getBrainServiceConfig();
        expect(cfg.chat.provider).toBe("openai");
        expect(cfg.chat.openai?.apiKey).toBe("sk-test-deepseek");
        expect(cfg.chat.openai?.model).toBe("deepseek-v4-flash");
        expect(cfg.chat.openai?.chatCompletionsUrl).toBe(
            "https://api.deepseek.com/chat/completions"
        );
        expect(formatChatProviderStartupLine(cfg)).toContain("provider=openai");
        expect(formatChatProviderStartupLine(cfg)).not.toContain("sk-test");
    });

    it("does not treat OPENAI_API_KEY alone as switching provider", () => {
        delete process.env.CHAT_PROVIDER;
        process.env.OPENAI_API_KEY = "sk-present-but-unused";
        const cfg = getBrainServiceConfig();
        expect(cfg.chat.provider).toBe("ollama");
        expect(cfg.chat.openai).toBeNull();
    });
});
