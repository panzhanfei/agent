import type { BrainServiceConfig } from "@fambrain/brain-config";
import { formatOllamaError } from "../ollama-native-stream";
import type {
    CompleteChatOptions,
    CompleteChatResult,
} from "./interface";

type OllamaChatResponse = {
    message?: {
        content?: unknown;
    };
    prompt_eval_count?: unknown;
    eval_count?: unknown;
};

export const completeOllamaChat = async (
    ollama: BrainServiceConfig["ollama"],
    options: CompleteChatOptions
): Promise<CompleteChatResult> => {
    const model = options.model ?? ollama.models.intakeCoordinator;
    const temperature = options.temperature;
    const res = await fetch(ollama.chatEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            messages: options.messages,
            stream: false,
            ...(options.jsonMode ? { format: "json" } : {}),
            ...(temperature !== undefined ? { options: { temperature } } : {}),
        }),
        signal: options.signal,
    });
    const raw = await res.text().catch(() => "");
    if (!res.ok) {
        throw new Error(formatOllamaError(raw, res.status, ollama.baseUrl));
    }
    let parsed: OllamaChatResponse;
    try {
        parsed = JSON.parse(raw) as OllamaChatResponse;
    } catch {
        throw new Error(
            `Ollama 聊天返回非 JSON（${ollama.chatEndpoint}）：${raw.slice(0, 400)}`
        );
    }
    const text =
        typeof parsed.message?.content === "string"
            ? parsed.message.content.trim()
            : "";
    if (!text) {
        throw new Error(
            `Ollama 未返回助手文本：请确认服务已启动且模型 ${model} 已拉取（${ollama.baseUrl}）`
        );
    }
    const prompt = Number(parsed.prompt_eval_count ?? 0);
    const completion = Number(parsed.eval_count ?? 0);
    const usage =
        Number.isFinite(prompt) || Number.isFinite(completion)
            ? {
                  prompt: Number.isFinite(prompt) ? prompt : 0,
                  completion: Number.isFinite(completion) ? completion : 0,
              }
            : undefined;
    return {
        text,
        usage:
            usage && (usage.prompt > 0 || usage.completion > 0)
                ? usage
                : undefined,
        provider: "ollama",
        model,
    };
};
