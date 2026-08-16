import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOllama } from "@langchain/ollama";
import { getBrainServiceConfig } from "@fambrain/brain-config";
import { logAgentIn, logAgentOut } from "@fambrain/brain-shared/agent-log";
import { recordLangChainOllamaUsage } from "@fambrain/brain-shared/pipeline-run-context";
import { parseJsonObject, textFromResponse } from "@/agentflow/utils";
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
  const { ollama } = getBrainServiceConfig();

  logAgentIn("UserMemoryExtract", "进入", {
    userQuestion: q.length > 200 ? `${q.slice(0, 200)}…` : q,
    model: cfg.ollamaModel,
    minConfidence: cfg.minConfidence,
  });

  try {
    const llm = new ChatOllama({
      baseUrl: ollama.baseUrl,
      model: cfg.ollamaModel,
    });
    const messages = [
      new SystemMessage(USER_MEMORY_EXTRACT_PROMPT),
      new HumanMessage(`【用户本轮原话】\n${q}`),
    ];
    const ai = await llm.invoke(messages);
    const raw = textFromResponse(ai.content) || "";
    recordLangChainOllamaUsage(ai, {
      promptText: JSON.stringify(messages.map((m) => m.content)),
      completionText: raw,
      node: "persist_turn_end",
    });

    const obj = parseJsonObject<unknown>(raw);
    const { facts } = parseUserMemoryExtractResult(obj, cfg.minConfidence);

    logAgentOut("UserMemoryExtract", "出去", {
      factCount: facts.length,
      keys: facts.map((f) => f.factKey),
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
