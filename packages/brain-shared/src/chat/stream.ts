import { getBrainServiceConfig } from "@fambrain/brain-config";
import { streamOllamaNative } from "../ollama-native-stream";
import type {
    ChatStreamChunk,
    ChatTokenUsage,
    StreamChatOptions,
} from "./interface";
import { streamOpenAiCompatChat } from "./stream-openai";

/**
 * 流式 Chat Completions。provider 由 CHAT_PROVIDER 决定；
 * openai 失败时抛错，不回落到 Ollama。
 */
export async function* streamChat(
    options: StreamChatOptions
): AsyncGenerator<ChatStreamChunk, ChatTokenUsage | undefined> {
    const cfg = getBrainServiceConfig();
    if (cfg.chat.provider === "openai") {
        if (!cfg.chat.openai) {
            throw new Error(
                "CHAT_PROVIDER=openai 但缺少 OPENAI_API_KEY / DEEPSEEK_API_KEY"
            );
        }
        return yield* streamOpenAiCompatChat(cfg.chat.openai, options);
    }
    const gen = streamOllamaNative({
        messages: options.messages,
        think: options.thinking === "enabled",
        model: options.model,
        signal: options.signal,
        formatJson: options.jsonMode,
    });
    while (true) {
        const next = await gen.next();
        if (next.done) {
            const usage = next.value;
            if (!usage) return undefined;
            return {
                prompt: usage.promptTokens,
                completion: usage.completionTokens,
            };
        }
        yield next.value;
    }
}
