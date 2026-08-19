import type { OpenAiCompatChatConfig } from "@fambrain/brain-config";
import type {
    CompleteChatOptions,
    CompleteChatResult,
} from "./interface";

export const formatOpenAiCompatError = (
    raw: string,
    status: number,
    url: string
): string => {
    const t = raw.trim();
    let detail = t;
    if (t) {
        try {
            const j = JSON.parse(t) as {
                error?: unknown;
                message?: unknown;
            };
            if (typeof j.error === "string" && j.error.length > 0) {
                detail = j.error;
            } else if (j.error && typeof j.error === "object") {
                const err = j.error as { message?: unknown };
                if (typeof err.message === "string" && err.message.length > 0)
                    detail = err.message;
            } else if (typeof j.message === "string" && j.message.length > 0) {
                detail = j.message;
            }
        } catch {
            // keep raw
        }
    } else {
        detail = `无响应正文`;
    }
    const clipped = detail.length > 600 ? `${detail.slice(0, 600)}…` : detail;
    return `OpenAI 兼容聊天失败（HTTP ${status}，${url}）：${clipped}`;
};

type OpenAiChatCompletion = {
    choices?: Array<{
        message?: {
            content?: unknown;
        };
        finish_reason?: unknown;
    }>;
    usage?: {
        prompt_tokens?: unknown;
        completion_tokens?: unknown;
    };
    model?: unknown;
};

const textFromChoice = (body: OpenAiChatCompletion): string => {
    const content = body.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : "";
};

const usageFromBody = (
    body: OpenAiChatCompletion
): CompleteChatResult["usage"] => {
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

export const completeOpenAiCompatChat = async (
    openai: OpenAiCompatChatConfig,
    options: CompleteChatOptions
): Promise<CompleteChatResult> => {
    const model = options.model ?? openai.model;
    const thinkingType = options.thinking ?? "disabled";
    const temperature =
        options.temperature ?? (options.jsonMode ? 0 : undefined);
    const body: Record<string, unknown> = {
        model,
        messages: options.messages,
        stream: false,
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
    const raw = await res.text().catch(() => "");
    if (!res.ok) {
        throw new Error(
            formatOpenAiCompatError(raw, res.status, openai.chatCompletionsUrl)
        );
    }
    let parsed: OpenAiChatCompletion;
    try {
        parsed = JSON.parse(raw) as OpenAiChatCompletion;
    } catch {
        throw new Error(
            `OpenAI 兼容聊天返回非 JSON（${openai.chatCompletionsUrl}）：${raw.slice(0, 400)}`
        );
    }
    const text = textFromChoice(parsed);
    if (!text) {
        throw new Error(
            `OpenAI 兼容聊天未返回助手文本（${openai.chatCompletionsUrl}，model=${model}）`
        );
    }
    return {
        text,
        usage: usageFromBody(parsed),
        provider: "openai",
        model: typeof parsed.model === "string" ? parsed.model : model,
    };
};
