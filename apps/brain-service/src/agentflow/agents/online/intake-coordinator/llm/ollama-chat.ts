import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { ChatOllama } from "@langchain/ollama";
import { getBrainServiceConfig } from "@fambrain/brain-config";
import { logAgentIn, logAgentOut } from "@fambrain/brain-shared/agent-log";
import { recordLangChainOllamaUsage } from "@fambrain/brain-shared/pipeline-run-context";
import type { DbChatTurn } from "@fambrain/brain-types";
import { textFromResponse } from "@/agentflow/utils";
import {
  JSON_FORMAT_REPAIR_NOTE,
  prompt,
} from "@/agentflow/agents/online/intake-coordinator/contract";

const { ollama } = getBrainServiceConfig();
const llm = new ChatOllama({
  baseUrl: ollama.baseUrl,
  model: ollama.models.intakeCoordinator,
});
const turnToMessage = (t: DbChatTurn) => {
  if (t.role === "user") return new HumanMessage(t.content);
  if (t.role === "assistant") return new AIMessage(t.content);
  return new SystemMessage(t.content);
};

export const completeIntakeCoordinator = async (
  history: DbChatTurn[],
  options?: {
    memoryBlock?: string | null;
    intakeHistory?: DbChatTurn[];
    /** 散文/非 JSON：追加格式修复说明（仅 1 次） */
    jsonFormatRepair?: boolean;
    /**
     * 上轮实质用户问（结构化上下文字段，输入增强）。
     * 非二次规划；消不了指代 → clarify。
     */
    priorSubstantiveQuestion?: string | null;
    /** 本轮已抽取附件清单（仅元数据+预览；全文不进 Intake） */
    attachmentBrief?: string | null;
  }
): Promise<string> => {
  const recent = options?.intakeHistory ?? history;
  const trimmed = recent.length > 40 ? recent.slice(-40) : recent;
  const lastUser =
    [...trimmed].reverse().find((t) => t.role === "user")?.content ?? "";
  logAgentIn("IntakeCoordinator", "进入", {
    userQuestion: lastUser,
    turnCount: trimmed.length,
    hasMemoryBlock: Boolean(options?.memoryBlock),
    hasPriorSubstantive: Boolean(options?.priorSubstantiveQuestion?.trim()),
    jsonFormatRepair: Boolean(options?.jsonFormatRepair),
  });
  const messages: BaseMessage[] = [new SystemMessage(prompt)];
  if (options?.jsonFormatRepair) {
    messages.push(new SystemMessage(JSON_FORMAT_REPAIR_NOTE));
  }
  if (options?.memoryBlock) {
    messages.push(
      new SystemMessage(
        `以下为用户记忆上下文（Mem0 / LangMem），供理解指代与偏好，勿当作知识库 hits：\n\n${options.memoryBlock}`
      )
    );
  }
  const prior = options?.priorSubstantiveQuestion?.trim();
  if (prior) {
    messages.push(
      new SystemMessage(
        `【结构化上下文·上轮实质用户问】\n${prior}\n（供本轮 Understand+Plan 消解指代/实体替换；能消解则 pathPlan 写明实体并 coreference=resolved；不能则 clarify + unresolved。服务端不会再因指代二次调用你。）`
      )
    );
  }
  const attachBrief = options?.attachmentBrief?.trim();
  if (attachBrief) {
    messages.push(
      new SystemMessage(
        `【本轮聊天附件·已抽取文本】\n${attachBrief}\n须填 attachmentAction（extract|summarize|translate|ingest）；意图不清则 clarify + attachmentAction=null。禁止默认入库。全文已在服务端，pathPlan.searchQuery 无需粘贴全文。`
      )
    );
  }
  messages.push(...trimmed.map(turnToMessage));
  const ai = await llm.invoke(messages);
  const raw =
    textFromResponse(ai.content) ||
    "（模型未返回助手文本：请确认 Ollama 已启动且模型已拉取）";
  recordLangChainOllamaUsage(ai, {
    promptText: JSON.stringify(messages.map((m) => m.content)),
    completionText: raw,
    node: "intake",
  });
  logAgentOut("IntakeCoordinator", "出去", {
    routeJsonPreview: raw.length > 800 ? `${raw.slice(0, 800)}…` : raw,
    jsonFormatRepair: Boolean(options?.jsonFormatRepair),
  });
  return raw;
};
