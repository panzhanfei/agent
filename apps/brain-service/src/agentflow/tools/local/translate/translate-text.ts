/**
 * translate_text：结构化 text + targetLang → 有道 NMT。
 * 无凭证 → disabled；非法语种 → error（不猜）。
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { TranslateToolResult } from "./interface";
import {
  legalizeYoudaoSourceLang,
  legalizeYoudaoTargetLang,
} from "./lang";
import {
  isYoudaoTranslateConfigured,
  readYoudaoCredentials,
  translateWithYoudao,
} from "./youdao";

export const translateTextTool = tool(
  async (input) => {
    const text = input.text.trim();
    const targetRaw = input.targetLang.trim();
    const sourceRaw = input.sourceLang?.trim() || "auto";

    const payload = (result: TranslateToolResult) =>
      JSON.stringify(result);

    if (!text) {
      return payload({
        status: "empty",
        text,
        targetLang: targetRaw,
        sourceLang: sourceRaw,
        message: "待翻译文本为空。",
      });
    }

    if (!isYoudaoTranslateConfigured()) {
      return payload({
        status: "disabled",
        text,
        targetLang: targetRaw,
        sourceLang: sourceRaw,
        message:
          "Translate is not configured. Set YOUDAO_APP_KEY + YOUDAO_APP_SECRET (FAMBRAIN_TRANSLATE_PROVIDER=youdao).",
        provider: "youdao",
      });
    }

    const to = legalizeYoudaoTargetLang(targetRaw);
    if (!to) {
      return payload({
        status: "error",
        text,
        targetLang: targetRaw,
        sourceLang: sourceRaw,
        message: `Unsupported targetLang: ${targetRaw}`,
        provider: "youdao",
      });
    }
    const from = legalizeYoudaoSourceLang(sourceRaw);
    const creds = readYoudaoCredentials()!;

    try {
      const out = await translateWithYoudao({
        appKey: creds.appKey,
        appSecret: creds.appSecret,
        q: text,
        from,
        to,
      });
      if (!out.ok) {
        return payload({
          status: "error",
          text,
          targetLang: to,
          sourceLang: from,
          message: out.message,
          provider: "youdao",
        });
      }
      return payload({
        status: "ok",
        text,
        targetLang: to,
        sourceLang: from,
        translation: out.translation,
        provider: "youdao",
      });
    } catch (e) {
      return payload({
        status: "error",
        text,
        targetLang: to,
        sourceLang: from,
        message: e instanceof Error ? e.message : String(e),
        provider: "youdao",
      });
    }
  },
  {
    name: "translate_text",
    description:
      "Translate text via configured online provider (Youdao). Requires structured text and targetLang.",
    schema: z.object({
      text: z.string().min(1).describe("Text to translate"),
      targetLang: z
        .string()
        .min(1)
        .describe("Target language code, e.g. en / zh / ja"),
      sourceLang: z
        .string()
        .optional()
        .describe("Source language code or auto"),
    }),
  }
);
