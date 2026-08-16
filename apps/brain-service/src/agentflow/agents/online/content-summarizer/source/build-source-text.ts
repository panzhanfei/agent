import type { TurnAttachment } from "@fambrain/brain-types";
import type { InformationAnalystInput } from "@/agentflow/agents/online/information-analyst/interface";
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator";

const joinTurnAttachments = (files: TurnAttachment[]): string =>
  files
    .filter((f) => Boolean(f.text?.trim()))
    .map((f, i) => {
      const name = f.title || f.fileName || `附件 ${i + 1}`;
      return `## ${name}\n\n${f.text.trim()}`;
    })
    .join("\n\n---\n\n");

/**
 * 摘要正文优先级：
 * 1. 本轮聊天附件已抽取文本（attachmentAction=summarize）
 * 2. KM hits
 * 3. 用户问句（粘贴长文场景）
 */
export const buildSummarizeSourceText = (input: {
  userQuestion: string;
  decision: IntakeRoutingDecision;
  hits: InformationAnalystInput["hits"];
  turnAttachments?: TurnAttachment[] | null;
}): {
  text: string;
  sourceLabel: string | null;
} => {
  const fromAttach = joinTurnAttachments(input.turnAttachments ?? []);
  if (fromAttach.trim()) {
    const names = (input.turnAttachments ?? [])
      .map((f) => f.fileName)
      .filter(Boolean)
      .join("、");
    return {
      text: fromAttach,
      sourceLabel: names || "聊天附件",
    };
  }

  if (input.hits.length > 0) {
    const parts = input.hits.map((h, i) => {
      const header = `### 片段 ${i + 1}: ${h.title}\n路径: ${h.path}`;
      return `${header}\n\n${h.excerpt}`;
    });
    return {
      text: parts.join("\n\n---\n\n"),
      sourceLabel: input.decision.searchQuery || input.userQuestion,
    };
  }
  return {
    text: input.userQuestion,
    sourceLabel: null,
  };
};
