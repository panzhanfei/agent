import { describe, expect, it } from "vitest";
import { formatVisionOcrError } from "@/agentflow/agents/offline/doc-parser/parse-image-ocr";

describe("formatVisionOcrError", () => {
  it("unwraps nested OpenAI-style multimodal error", () => {
    const raw = JSON.stringify({
      error: JSON.stringify({
        error: {
          code: 400,
          message:
            "Multimodal data provided, but model does not support multimodal requests.",
          type: "invalid_request_error",
        },
      }),
    });
    const msg = formatVisionOcrError(raw, "qwen2.5:14b");
    expect(msg).toContain("不支持图片");
    expect(msg).toContain("OLLAMA_MODEL_VISION");
    expect(msg).toContain("qwen2.5:14b");
  });
});
