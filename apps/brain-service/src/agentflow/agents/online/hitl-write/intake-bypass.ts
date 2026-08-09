/**
 * UI exact-match 旁路：详情 / 确认 / 放弃 / 打开编辑 / 暂不编辑。
 */
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import { matchCorpusEditUiPrompt } from "./actions";
import {
  buildCorpusEditAppliedActions,
  buildCorpusEditAppliedAnswer,
  buildCorpusEditDetailAnswer,
  buildCorpusEditDismissEditAnswer,
  buildCorpusEditReviewActions,
} from "./compose-actions";
import { corpusEditErrorMessage } from "./errors";
import { ensureProposalNotStale, loadActionableProposal } from "./lifecycle";
import { previewCorpusMarkdown } from "./preview";
import { resumeCorpusEdit } from "./resume";
import type { CorpusEditOperation } from "./interface";
import { findCorpusEditProposalForUser } from "@fambrain/db";

const baseDirect = (briefReply: string): IntakeRoutingDecision => ({
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

const toOp = (raw: string): Exclude<CorpusEditOperation, "open"> => {
  if (raw === "CLEAR") return "clear";
  if (raw === "CREATE") return "create";
  return "update";
};

export type CorpusEditIntakeBypass = {
  decision: IntakeRoutingDecision;
  answer: string;
  assistantBlocks: AssistantMessageBlock[] | null;
  /** 客户端应作废的同组按钮 key */
  staleGroupKey?: string | null;
};

export const resolveCorpusEditUiBypass = async (input: {
  userQuestion: string;
  userId: string;
  corpusUserId: string;
  language?: "zh" | "en";
}): Promise<CorpusEditIntakeBypass | null> => {
  const action = matchCorpusEditUiPrompt(input.userQuestion);
  if (!action) return null;
  const language = input.language === "en" ? "en" : "zh";

  if (action.type === "dismiss_edit") {
    const answer = buildCorpusEditDismissEditAnswer(action.targetPath, language);
    return {
      decision: baseDirect(answer),
      answer,
      assistantBlocks: null,
      staleGroupKey: `path:${action.targetPath}`,
    };
  }

  if (action.type === "open") {
    // 聊天旁路：仍给预览文案；Web 优先 clientHandler=open_editor
    const preview = await previewCorpusMarkdown({
      corpusUserId: input.corpusUserId,
      targetPath: action.targetPath,
    });
    if (!preview.ok) {
      const msg = corpusEditErrorMessage(preview.error, language);
      return {
        decision: baseDirect(msg),
        answer: msg,
        assistantBlocks: null,
      };
    }
    const answer = [
      language === "en"
        ? `Ready to edit ${preview.repoPath}.`
        : `可以编辑 ${preview.repoPath}。`,
      language === "en"
        ? "Open the dual-mode editor (plain text / Markdown), then confirm update."
        : "请在双模式编辑器中修改（正文 / Markdown），提交后需再确认更新。",
    ].join("\n");
    return {
      decision: baseDirect(answer),
      answer,
      assistantBlocks: null,
      staleGroupKey: `path:${action.targetPath}`,
    };
  }

  if (action.type === "detail") {
    const found = await findCorpusEditProposalForUser(
      action.proposalId,
      input.userId
    );
    if (!found) {
      const msg = corpusEditErrorMessage("proposal_not_found", language);
      return { decision: baseDirect(msg), answer: msg, assistantBlocks: null };
    }
    const proposal = await ensureProposalNotStale(found);
    if (proposal.status === "EXPIRED") {
      const msg = corpusEditErrorMessage("proposal_expired", language);
      return {
        decision: baseDirect(msg),
        answer: msg,
        assistantBlocks: null,
        staleGroupKey: `proposal:${action.proposalId}`,
      };
    }
    const op = toOp(proposal.operation);
    const view = {
      proposalId: proposal.id,
      threadId: proposal.threadId,
      repoPath: proposal.repoPath,
      operation: op,
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
        ? [buildCorpusEditReviewActions(proposal.id, op, language)]
        : null;
    return {
      decision: baseDirect(answer),
      answer,
      assistantBlocks: blocks,
    };
  }

  const loaded = await loadActionableProposal(action.proposalId, input.userId);
  if (!loaded.ok) {
    const msg = corpusEditErrorMessage(loaded.error, language);
    return {
      decision: baseDirect(msg),
      answer: msg,
      assistantBlocks: null,
      staleGroupKey: `proposal:${action.proposalId}`,
    };
  }

  const op = toOp(loaded.proposal.operation);
  const resumed = await resumeCorpusEdit({
    userId: input.userId,
    proposalId: action.proposalId,
    action: action.type === "approve" ? "approve" : "reject",
  });

  if (!resumed.ok) {
    const msg = corpusEditErrorMessage(resumed.error, language);
    return {
      decision: baseDirect(msg),
      answer: msg,
      assistantBlocks: null,
      staleGroupKey: `proposal:${action.proposalId}`,
    };
  }

  if (action.type === "reject") {
    const msg =
      language === "en"
        ? op === "create"
          ? "Create cancelled. No file was written."
          : "This edit was discarded. On-disk file unchanged by this proposal."
        : op === "create"
          ? "已放弃新建，未写入任何文件。"
          : "已放弃本次修改；磁盘上已有文件保持不变。";
    return {
      decision: baseDirect(msg),
      answer: msg,
      assistantBlocks: null,
      staleGroupKey: `proposal:${action.proposalId}`,
    };
  }

  const chunks = resumed.result?.indexedChunks ?? 0;
  const path = resumed.result?.repoPath ?? loaded.proposal.repoPath;
  const answer = buildCorpusEditAppliedAnswer(path, chunks, op, language);
  return {
    decision: baseDirect(answer),
    answer,
    assistantBlocks: [buildCorpusEditAppliedActions(path, op, language)],
    staleGroupKey: `proposal:${action.proposalId}`,
  };
};
