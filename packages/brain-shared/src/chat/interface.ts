import type { ChatProvider } from "@fambrain/brain-config";

export type ChatMessageRole = "system" | "user" | "assistant";

export type ChatMessage = {
    role: ChatMessageRole;
    content: string;
};

export type ChatTokenUsage = {
    prompt: number;
    completion: number;
};

export type CompleteChatOptions = {
    messages: ChatMessage[];
    /** OpenAI `response_format=json_object`；Ollama `format=json` */
    jsonMode?: boolean;
    /**
     * DeepSeek V4 默认 thinking=enabled；Intake JSON 必须显式 disabled。
     * 未传且 jsonMode 时视为 disabled。
     */
    thinking?: "disabled" | "enabled";
    /** 未设时：jsonMode → 0；否则用提供方默认 */
    temperature?: number;
    model?: string;
    signal?: AbortSignal;
};

export type CompleteChatResult = {
    text: string;
    usage?: ChatTokenUsage;
    provider: ChatProvider;
    model: string;
};

export type ChatStreamChunk = {
    kind: "thinking" | "content";
    fullText: string;
};

export type StreamChatOptions = CompleteChatOptions;

