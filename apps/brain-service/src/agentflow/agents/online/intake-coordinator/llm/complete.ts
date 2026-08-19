import { logAgentIn, logAgentOut } from "@fambrain/brain-shared/agent-log";
import { completeChat, type ChatMessage } from "@fambrain/brain-shared/chat";
import { recordCompleteChatUsage } from "@fambrain/brain-shared/pipeline-run-context";
import type { DbChatTurn } from "@fambrain/brain-types";
import {
  ATTACHMENT_INTAKE_NOTE,
  JSON_FORMAT_REPAIR_NOTE,
  prompt,
} from "@/agentflow/agents/online/intake-coordinator/contract";
import type { CompleteIntakeCoordinatorOptions } from "./interface";

export type { CompleteIntakeCoordinatorOptions };

const turnToMessage = (t: DbChatTurn): ChatMessage => ({
  role: t.role,
  content: t.content,
});

export const completeIntakeCoordinator = async (
  history: DbChatTurn[],
  options?: CompleteIntakeCoordinatorOptions
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
  const messages: ChatMessage[] = [{ role: "system", content: prompt }];
  if (options?.jsonFormatRepair) {
    messages.push({ role: "system", content: JSON_FORMAT_REPAIR_NOTE });
  }
  if (options?.memoryBlock) {
    messages.push({
      role: "system",
      content: `以下为用户记忆上下文（Mem0 / LangMem），供理解指代与偏好，勿当作知识库 hits：\n\n${options.memoryBlock}`,
    });
  }
  const prior = options?.priorSubstantiveQuestion?.trim();
  if (prior) {
    messages.push({
      role: "system",
      content: `【结构化上下文·上轮实质用户问】\n${prior}\n（供本轮 Understand+Plan 消解指代/实体替换；能消解则 pathPlan 写明实体并 coreference=resolved；不能则 clarify + unresolved。服务端不会再因指代二次调用你。）`,
    });
  }
  const attachBrief = options?.attachmentBrief?.trim();
  if (attachBrief) {
    messages.push({
      role: "system",
      content: `${ATTACHMENT_INTAKE_NOTE}\n\n【本轮附件清单】\n${attachBrief}`,
    });
  }
  messages.push(...trimmed.map(turnToMessage));
  const result = await completeChat({
    messages,
    jsonMode: true,
    thinking: "disabled",
  });
  recordCompleteChatUsage(result.usage, {
    promptText: JSON.stringify(messages.map((m) => m.content)),
    completionText: result.text,
    node: "intake",
  });
  logAgentOut("IntakeCoordinator", "出去", {
    routeJsonPreview:
      result.text.length > 800 ? `${result.text.slice(0, 800)}…` : result.text,
    jsonFormatRepair: Boolean(options?.jsonFormatRepair),
    chatProvider: result.provider,
    chatModel: result.model,
  });
  return result.text;
};
