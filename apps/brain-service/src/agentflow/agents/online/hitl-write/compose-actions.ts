import type { AssistantMessageBlock } from "@fambrain/brain-types";
import {
  corpusEditApprovePrompt,
  corpusEditDetailPrompt,
  corpusEditRejectPrompt,
} from "./actions";
import type { CorpusEditOperation, CorpusEditProposalView } from "./interface";

export const buildCorpusEditPendingAnswer = (
  proposal: Pick<CorpusEditProposalView, "repoPath" | "operation">,
  language: "zh" | "en" = "zh"
): string => {
  if (language === "en") {
    return `Draft ready for ${proposal.repoPath} (${proposal.operation}). Open details to review, then approve or reject.`;
  }
  return `已准备完成语料修订草案（${proposal.repoPath}，${proposal.operation}）。请点击详情确认后再写入。`;
};

export const buildCorpusEditPendingActions = (
  proposalId: string
): AssistantMessageBlock => ({
  type: "actions",
  actions: [
    {
      id: "corpus_edit_detail",
      label: "查看详情确认",
      prompt: corpusEditDetailPrompt(proposalId),
    },
  ],
});

export const buildCorpusEditDetailAnswer = (
  proposal: CorpusEditProposalView,
  language: "zh" | "en" = "zh"
): string => {
  const op =
    language === "en"
      ? proposal.operation
      : proposal.operation === "clear"
        ? "清空"
        : proposal.operation === "create"
          ? "新建"
          : "更新";
  const before = proposal.beforeContent.trim() || "（空）";
  const after =
    proposal.operation === "clear"
      ? language === "en"
        ? "(cleared)"
        : "（清空）"
      : proposal.afterContent.trim() || "（空）";
  if (language === "en") {
    return [
      `Path: ${proposal.repoPath}`,
      `Operation: ${op}`,
      "",
      "--- before ---",
      before,
      "",
      "--- after ---",
      after,
    ].join("\n");
  }
  return [
    `路径：${proposal.repoPath}`,
    `操作：${op}`,
    "",
    "--- 变更前 ---",
    before,
    "",
    "--- 变更后 ---",
    after,
  ].join("\n");
};

export const buildCorpusEditReviewActions = (
  proposalId: string
): AssistantMessageBlock => ({
  type: "actions",
  actions: [
    {
      id: "corpus_edit_approve",
      label: "确认写入",
      prompt: corpusEditApprovePrompt(proposalId),
    },
    {
      id: "corpus_edit_reject",
      label: "放弃",
      prompt: corpusEditRejectPrompt(proposalId),
    },
  ],
});

export const operationLabel = (op: CorpusEditOperation): string => op;
