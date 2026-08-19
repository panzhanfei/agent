/**
 * 文件子线政策：只信信封结构化字段，不扫问句。
 */
import type { FileAgentEnvelope } from "../interface";

/** 新材料终稿才出闸：附件总结/翻译、粘贴长文总结。查库摘要与普通 QA 不出。 */
export const shouldRunFileAgent = (envelope: FileAgentEnvelope): boolean => {
  if (envelope.task === "workspace") {
    return true;
  }
  if (envelope.task !== "save_offer") return false;
  if (!envelope.draft.trim()) return false;
  if (
    envelope.attachmentAction === "translate" ||
    envelope.attachmentAction === "summarize"
  ) {
    return true;
  }
  const isSummarize =
    envelope.composeMode === "summarize" ||
    envelope.intent === "summarize_content";
  if (!isSummarize) return false;
  return !envelope.hasPathSteps && !envelope.hasSearchQuery;
};
