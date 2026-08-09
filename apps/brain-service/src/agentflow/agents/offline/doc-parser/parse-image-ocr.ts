import { getBrainServiceConfig } from "@fambrain/brain-config";

const visionModel = (): string | null => {
  const fromEnv = process.env.OLLAMA_MODEL_VISION?.trim();
  if (fromEnv) return fromEnv;
  return null;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  error?: string | { message?: string; code?: number | string };
};

/** 解开嵌套 JSON / OpenAI 风格 error，给出可读中文 */
export const formatVisionOcrError = (
  raw: string,
  model: string
): string => {
  let message = raw.trim();
  for (let i = 0; i < 3; i += 1) {
    try {
      const parsed = JSON.parse(message) as {
        error?:
          | string
          | { message?: string; code?: number | string; type?: string };
        message?: string;
      };
      if (typeof parsed.error === "string") {
        message = parsed.error;
        continue;
      }
      if (parsed.error && typeof parsed.error === "object") {
        message =
          parsed.error.message?.trim() ||
          JSON.stringify(parsed.error);
        continue;
      }
      if (typeof parsed.message === "string") {
        message = parsed.message;
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  const lower = message.toLowerCase();
  if (
    lower.includes("multimodal") ||
    lower.includes("does not support multimodal") ||
    lower.includes("vision")
  ) {
    return (
      `当前模型「${model}」不支持图片（multimodal）。` +
      `请在仓库根目录 .env 设置 OLLAMA_MODEL_VISION 为支持视觉的模型（如 llava、qwen2.5-vl），并确保已 ollama pull。`
    );
  }
  return (
    message ||
    `图片 OCR 失败，请确认 Ollama 已启动且模型 ${model} 支持 vision`
  );
};

export const parseImageWithOllamaOcr = async (
  buffer: Buffer,
  fileName: string
): Promise<string> => {
  const { chatEndpoint, models } = getBrainServiceConfig().ollama;
  const model = visionModel();
  if (!model) {
    throw new Error(
      `图片「${fileName}」需要视觉模型。请在 .env 设置 OLLAMA_MODEL_VISION（如 llava 或 qwen2.5-vl），勿用纯文本模型 ${models.default} 做 OCR。`
    );
  }

  const base64 = buffer.toString("base64");
  const res = await fetch(chatEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "user",
          content: `请从图片「${fileName}」中提取全部可见文字，保留段落结构；只输出纯文本，不要解释。`,
          images: [base64],
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(formatVisionOcrError(text, model));
  }
  const payload = (await res.json()) as OllamaChatResponse;
  if (payload.error) {
    const errText =
      typeof payload.error === "string"
        ? payload.error
        : payload.error.message || JSON.stringify(payload.error);
    throw new Error(formatVisionOcrError(errText, model));
  }
  const text = payload.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error(
      `视觉模型「${model}」未返回图片文字。请换用支持 OCR 的 vision 模型，或检查图片是否含可读文字。`
    );
  }
  return text;
};
