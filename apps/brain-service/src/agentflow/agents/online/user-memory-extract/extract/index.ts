import { getBrainServiceConfig } from "@fambrain/brain-config";
import { logAgentIn, logAgentOut } from "@fambrain/brain-shared/agent-log";
import { completeChat } from "@fambrain/brain-shared/chat";
import { recordCompleteChatUsage } from "@fambrain/brain-shared/pipeline-run-context";
import { parseJsonObject } from "@/agentflow/utils";
import { getUserMemoryAutoLearnConfig } from "../config";
import type { ExtractedUserMemoryFact } from "../interface";
import { USER_MEMORY_EXTRACT_PROMPT } from "./prompt";
import { parseUserMemoryExtractResult } from "./schema";

export { USER_MEMORY_EXTRACT_PROMPT } from "./prompt";
export {
  legalizeExtractedUserMemoryFacts,
  parseUserMemoryExtractResult,
} from "./schema";

/**
 * 独立 LLM 抽取（非 Intake）。仅消费用户原话。
 * 失败 / 非 JSON → 空列表（静默）。
 */
export const extractUserMemoryFactsFromUtterance = async (
  userQuestion: string
): Promise<ExtractedUserMemoryFact[]> => {
  const q = userQuestion.trim();
  if (!q) return [];

  const cfg = getUserMemoryAutoLearnConfig();
  const brain = getBrainServiceConfig();
  const model =
    brain.chat.provider === "ollama" ? cfg.ollamaModel : undefined;

  logAgentIn("UserMemoryExtract", "进入", {
    userQuestion: q.length > 200 ? `${q.slice(0, 200)}…` : q,
    chatProvider: brain.chat.provider,
    model:
      brain.chat.provider === "openai"
        ? brain.chat.openai?.model
        : cfg.ollamaModel,
    minConfidence: cfg.minConfidence,
  });

  try {
    const userContent = `【用户本轮原话】\n${q}`;
    const resultChat = await completeChat({
      messages: [
        { role: "system", content: USER_MEMORY_EXTRACT_PROMPT },
        { role: "user", content: userContent },
      ],
      jsonMode: true,
      thinking: "disabled",
      model,
    });
    recordCompleteChatUsage(resultChat.usage, {
      promptText: `${USER_MEMORY_EXTRACT_PROMPT}\n${userContent}`,
      completionText: resultChat.text,
      node: "persist_turn_end",
    });

    const obj = parseJsonObject<unknown>(resultChat.text);
    const { facts } = parseUserMemoryExtractResult(obj, cfg.minConfidence);

    logAgentOut("UserMemoryExtract", "出去", {
      factCount: facts.length,
      keys: facts.map((f) => f.factKey),
      chatProvider: resultChat.provider,
    });
    return facts;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn("[UserMemoryExtract] extract failed:", message);
    logAgentOut("UserMemoryExtract", "出去", {
      ok: false,
      error: message,
    });
    return [];
  }
};
