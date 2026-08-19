import type { OpenAiCompatChatConfig } from "@fambrain/brain-config";
import type {
    ChatStreamChunk,
    ChatTokenUsage,
    StreamChatOptions,
} from "./interface";
import { formatOpenAiCompatError } from "./openai-compat";

type OpenAiStreamJson = {
    choices?: Array<{
        delta?: {
            content?: unknown;
            reasoning_content?: unknown;
            reasoning?: unknown;
        };
    }>;
    usage?: {
        prompt_tokens?: unknown;
        completion_tokens?: unknown;
    };
};

const appendDelta = (acc: string, chunk: unknown): string => {
    if (typeof chunk !== "string" || chunk.length === 0) return acc;
    return acc + chunk;
};

const usageFromJson = (body: OpenAiStreamJson): ChatTokenUsage | undefined => {
    const prompt = Number(body.usage?.prompt_tokens ?? 0);
    const completion = Number(body.usage?.completion_tokens ?? 0);
    if (!Number.isFinite(prompt) && !Number.isFinite(completion))
        return undefined;
    if (prompt === 0 && completion === 0) return undefined;
    return {
        prompt: Number.isFinite(prompt) ? prompt : 0,
        completion: Number.isFinite(completion) ? completion : 0,
    };
};

const consumeSseData = (
    data: string,
    state: {
        thinkingAcc: string;
        contentAcc: string;
        usage?: ChatTokenUsage;
    }
): ChatStreamChunk[] => {
    if (!data || data === "[DONE]") return [];
    let json: OpenAiStreamJson;
    try {
        json = JSON.parse(data) as OpenAiStreamJson;
    } catch {
        return [];
    }
    const usage = usageFromJson(json);
    if (usage) state.usage = usage;
    const delta = json.choices?.[0]?.delta;
    if (!delta) return [];
    const out: ChatStreamChunk[] = [];
    const reasoning = delta.reasoning_content ?? delta.reasoning;
    const nextThinking = appendDelta(state.thinkingAcc, reasoning);
    if (nextThinking !== state.thinkingAcc) {
        state.thinkingAcc = nextThinking;
        out.push({ kind: "thinking", fullText: state.thinkingAcc });
    }
    const nextContent = appendDelta(state.contentAcc, delta.content);
    if (nextContent !== state.contentAcc) {
        state.contentAcc = nextContent;
        out.push({ kind: "content", fullText: state.contentAcc });
    }
    return out;
};

export async function* streamOpenAiCompatChat(
    openai: OpenAiCompatChatConfig,
    options: StreamChatOptions
): AsyncGenerator<ChatStreamChunk, ChatTokenUsage | undefined> {
    const model = options.model ?? openai.model;
    const thinkingType = options.thinking ?? "disabled";
    const temperature =
        options.temperature ?? (options.jsonMode ? 0 : undefined);
    const body: Record<string, unknown> = {
        model,
        messages: options.messages,
        stream: true,
        stream_options: { include_usage: true },
        thinking: { type: thinkingType },
    };
    if (options.jsonMode) {
        body.response_format = { type: "json_object" };
    }
    if (temperature !== undefined) {
        body.temperature = temperature;
    }
    const res = await fetch(openai.chatCompletionsUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openai.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: options.signal,
    });
    if (!res.ok || !res.body) {
        const raw = await res.text().catch(() => "");
        throw new Error(
            formatOpenAiCompatError(raw, res.status, openai.chatCompletionsUrl)
        );
    }
    const state = {
        thinkingAcc: "",
        contentAcc: "",
        usage: undefined as ChatTokenUsage | undefined,
    };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            for (const chunk of consumeSseData(trimmed.slice(5).trim(), state)) {
                yield chunk;
            }
        }
    }
    if (buffer.trim().startsWith("data:")) {
        for (const chunk of consumeSseData(buffer.trim().slice(5).trim(), state)) {
            yield chunk;
        }
    }
    if (!state.contentAcc.trim()) {
        throw new Error(
            `OpenAI 兼容聊天未返回助手文本（${openai.chatCompletionsUrl}，model=${model}）`
        );
    }
    return state.usage;
}
