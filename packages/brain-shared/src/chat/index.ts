import { getBrainServiceConfig } from "@fambrain/brain-config";
import { completeOllamaChat } from "./ollama";
import { completeOpenAiCompatChat } from "./openai-compat";
import type { CompleteChatOptions, CompleteChatResult } from "./interface";

export type {
    ChatMessage,
    ChatMessageRole,
    ChatStreamChunk,
    ChatTokenUsage,
    CompleteChatOptions,
    CompleteChatResult,
    StreamChatOptions,
} from "./interface";
export { completeOpenAiCompatChat } from "./openai-compat";
export { completeOllamaChat } from "./ollama";
export { streamChat } from "./stream";

/**
 * 非流式 Chat Completions。provider 由 CHAT_PROVIDER 决定；
 * openai 失败时抛错，不回落到 Ollama。
 */
export const completeChat = async (
    options: CompleteChatOptions
): Promise<CompleteChatResult> => {
    const cfg = getBrainServiceConfig();
    if (cfg.chat.provider === "openai") {
        if (!cfg.chat.openai) {
            throw new Error(
                "CHAT_PROVIDER=openai 但缺少 OPENAI_API_KEY / DEEPSEEK_API_KEY"
            );
        }
        return completeOpenAiCompatChat(cfg.chat.openai, options);
    }
    return completeOllamaChat(cfg.ollama, options);
};
