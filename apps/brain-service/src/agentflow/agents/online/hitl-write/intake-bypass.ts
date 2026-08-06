/**
 * UI exact-match 旁路：详情 / 确认 / 放弃（与列举按钮同一模式）。
 */
import { findCorpusEditProposalForUser } from "@fambrain/db";
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import { matchCorpusEditUiPrompt } from "./actions";
import {
  buildCorpusEditDetailAnswer,
  buildCorpusEditReviewActions,
} from "./compose-actions";
import { resumeCorpusEdit } from "./resume";
import type { CorpusEditOperation } from "./interface";

const baseDirect = (
  briefReply: string
): IntakeRoutingDecision => ({
  intent: "direct_answer",
  searchQuery: "",
  subTasks: [],
  topics: [],
  language: "zh",
  confidence: 1,
  queryType: "default",
  clarifyingQuestion: null,
  briefReply,
  retrievalPlan: [],
  userFactKey: null,
  userFactLabel: null,
  userFactValue: null,
});

const toOp = (raw: string): CorpusEditOperation => {
  if (raw === "CLEAR") return "clear";
  if (raw === "CREATE") return "create";
  return "update";
};

export type CorpusEditIntakeBypass = {
  decision: IntakeRoutingDecision;
  answer: string;
  assistantBlocks: AssistantMessageBlock[] | null;
};

export const resolveCorpusEditUiBypass = async (input: {
  userQuestion: string;
  userId: string;
  language?: "zh" | "en";
}): Promise<CorpusEditIntakeBypass | null> => {
  const action = matchCorpusEditUiPrompt(input.userQuestion);
  if (!action) return null;
  const language = input.language === "en" ? "en" : "zh";

  const proposal = await findCorpusEditProposalForUser(
    action.proposalId,
    input.userId
  );
  if (!proposal) {
    const msg =
      language === "en"
        ? "This edit proposal was not found or has expired."
        : "未找到该语料修订提案，可能已过期。";
    return {
      decision: baseDirect(msg),
      answer: msg,
      assistantBlocks: null,
    };
  }

  if (action.type === "detail") {
    const view = {
      proposalId: proposal.id,
      threadId: proposal.threadId,
      repoPath: proposal.repoPath,
      operation: toOp(proposal.operation),
      beforeContent: proposal.beforeContent,
      afterContent: proposal.afterContent,
      status:
        proposal.status === "APPLIED"
          ? ("applied" as const)
          : proposal.status === "REJECTED"
            ? ("rejected" as const)
            : ("pending_review" as const),
    };
    const answer = buildCorpusEditDetailAnswer(view, language);
    const blocks =
      proposal.status === "PENDING_REVIEW"
        ? [buildCorpusEditReviewActions(proposal.id)]
        : null;
    return {
      decision: baseDirect(answer),
      answer,
      assistantBlocks: blocks,
    };
  }

  const resumed = await resumeCorpusEdit({
    userId: input.userId,
    proposalId: action.proposalId,
    action: action.type === "approve" ? "approve" : "reject",
  });

  if (!resumed.ok) {
    const msg =
      language === "en"
        ? `Could not ${action.type} the proposal (${resumed.error}).`
        : `无法${action.type === "approve" ? "确认" : "放弃"}提案（${resumed.error}）。`;
    return {
      decision: baseDirect(msg),
      answer: msg,
      assistantBlocks: null,
    };
  }

  if (action.type === "reject") {
    const msg =
      language === "en"
        ? "Edit proposal discarded. No files were changed."
        : "已放弃该语料修订，未写入任何文件。";
    return {
      decision: baseDirect(msg),
      answer: msg,
      assistantBlocks: null,
    };
  }

  const chunks = resumed.result?.indexedChunks ?? 0;
  const path = resumed.result?.repoPath ?? proposal.repoPath;
  const msg =
    language === "en"
      ? `Applied. Updated ${path} and refreshed ${chunks} vector chunk(s).`
      : `已确认写入 ${path}，并按 path 更新向量（${chunks} 个 chunk）。`;
  return {
    decision: baseDirect(msg),
    answer: msg,
    assistantBlocks: null,
  };
};
