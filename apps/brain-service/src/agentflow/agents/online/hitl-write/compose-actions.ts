import type { AssistantMessageBlock } from "@fambrain/brain-types";
import {
  corpusEditApprovePrompt,
  corpusEditDetailPrompt,
  corpusEditDismissEditPrompt,
  corpusEditOpenFilePrompt,
  corpusEditRejectPrompt,
} from "./actions";
import type { CorpusEditOperation, CorpusEditProposalView } from "./interface";

type WriteOp = Exclude<CorpusEditOperation, "open">;

const opZh = (op: WriteOp): string => {
  if (op === "clear") return "清空";
  if (op === "create") return "新建";
  return "更新";
};

const approveLabel = (op: WriteOp, language: "zh" | "en"): string => {
  if (language === "en") {
    if (op === "clear") return "Confirm clear";
    if (op === "create") return "Confirm create";
    return "Confirm update";
  }
  if (op === "clear") return "确定清空";
  if (op === "create") return "确定新建";
  return "确定更新";
};

const rejectLabel = (op: WriteOp, language: "zh" | "en"): string => {
  if (language === "en") {
    if (op === "clear") return "Cancel clear";
    if (op === "create") return "Cancel create";
    return "Discard this edit";
  }
  if (op === "clear") return "放弃清空";
  if (op === "create") return "放弃新建";
  return "放弃本次修改";
};

export const buildCorpusEditPendingAnswer = (
  proposal: Pick<CorpusEditProposalView, "repoPath" | "operation" | "afterContent">,
  language: "zh" | "en" = "zh"
): string => {
  const op = proposal.operation;
  const empty = !proposal.afterContent.trim();
  if (language === "en") {
    const bodyHint =
      op === "clear"
        ? "Content will be cleared."
        : empty
          ? "After content: (empty file)."
          : "After content is ready for review.";
    return [
      `Pending ${op} at:`,
      proposal.repoPath,
      bodyHint,
      "Confirm or cancel below. Open details to inspect before/after.",
    ].join("\n");
  }
  const bodyHint =
    op === "clear"
      ? "变更后：将清空文件内容。"
      : empty
        ? "变更后：（空文件）"
        : "变更后正文已就绪，可查看详情。";
  return [
    `待确认${opZh(op)}，写入路径：`,
    proposal.repoPath,
    bodyHint,
    "请选择下方操作（可先查看变更详情）。",
  ].join("\n");
};

/** 待批：按 operation 分阶段按钮 + 可选详情 */
export const buildCorpusEditPendingActions = (
  proposalId: string,
  operation: WriteOp,
  language: "zh" | "en" = "zh"
): AssistantMessageBlock => ({
  type: "actions",
  actions: [
    {
      id: "corpus_edit_approve",
      label: approveLabel(operation, language),
      prompt: corpusEditApprovePrompt(proposalId),
      displayText: approveLabel(operation, language),
    },
    {
      id: "corpus_edit_reject",
      label: rejectLabel(operation, language),
      prompt: corpusEditRejectPrompt(proposalId),
      displayText: rejectLabel(operation, language),
    },
    {
      id: "corpus_edit_detail",
      label: language === "en" ? "View details" : "查看变更详情",
      prompt: corpusEditDetailPrompt(proposalId),
      displayText: language === "en" ? "View details" : "查看变更详情",
    },
  ],
});

export const buildCorpusEditDetailAnswer = (
  proposal: CorpusEditProposalView,
  language: "zh" | "en" = "zh"
): string => {
  const op = opZh(proposal.operation);
  const before = proposal.beforeContent.trim() || "（空）";
  const after =
    proposal.operation === "clear"
      ? language === "en"
        ? "(cleared)"
        : "（清空）"
      : proposal.afterContent.trim() || "（空文件）";
  if (language === "en") {
    return [
      `Write to: ${proposal.repoPath}`,
      `Operation: ${proposal.operation}`,
      "",
      "--- before ---",
      before === "（空）" ? "(empty)" : before,
      "",
      "--- after ---",
      after,
    ].join("\n");
  }
  return [
    `写入路径：${proposal.repoPath}`,
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
  proposalId: string,
  operation: WriteOp,
  language: "zh" | "en" = "zh"
): AssistantMessageBlock => ({
  type: "actions",
  actions: [
    {
      id: "corpus_edit_approve",
      label: approveLabel(operation, language),
      prompt: corpusEditApprovePrompt(proposalId),
      displayText: approveLabel(operation, language),
    },
    {
      id: "corpus_edit_reject",
      label: rejectLabel(operation, language),
      prompt: corpusEditRejectPrompt(proposalId),
      displayText: rejectLabel(operation, language),
    },
  ],
});

/** 写盘成功后：按 operation 给出「是否编辑」 */
export const buildCorpusEditAppliedAnswer = (
  repoPath: string,
  indexedChunks: number,
  operation: WriteOp,
  language: "zh" | "en" = "zh"
): string => {
  if (language === "en") {
    if (operation === "create") {
      return `Created ${repoPath} (vector chunks=${indexedChunks}). Edit this new file now?`;
    }
    if (operation === "clear") {
      return `Cleared ${repoPath} (vector chunks=${indexedChunks}).`;
    }
    return `Updated ${repoPath} (vector chunks=${indexedChunks}). Continue editing?`;
  }
  if (operation === "create") {
    return `新建成功：${repoPath}（已按 path 更新向量，${indexedChunks} 个 chunk）。是否编辑新建文件？`;
  }
  if (operation === "clear") {
    return `已清空：${repoPath}（向量已更新，${indexedChunks} 个 chunk）。`;
  }
  return `更新成功：${repoPath}（向量已更新，${indexedChunks} 个 chunk）。是否继续编辑？`;
};

export const buildCorpusEditAppliedActions = (
  targetPath: string,
  operation: WriteOp,
  language: "zh" | "en" = "zh"
): AssistantMessageBlock => {
  if (operation === "clear") {
    return {
      type: "actions",
      actions: [
        {
          id: "corpus_edit_open",
          label: language === "en" ? "Open file" : "查看文件",
          prompt: corpusEditOpenFilePrompt(targetPath),
          displayText: language === "en" ? "Open file" : "查看文件",
          clientHandler: "open_editor",
        },
      ],
    };
  }
  const editLabel =
    language === "en"
      ? operation === "create"
        ? "Edit new file"
        : "Continue editing"
      : operation === "create"
        ? "编辑新建文件"
        : "继续编辑";
  const dismissLabel =
    language === "en"
      ? operation === "create"
        ? "Not now"
        : "Done"
      : operation === "create"
        ? "暂不编辑"
        : "完成";
  return {
    type: "actions",
    actions: [
      {
        id: "corpus_edit_open",
        label: editLabel,
        prompt: corpusEditOpenFilePrompt(targetPath),
        displayText: editLabel,
        clientHandler: "open_editor",
      },
      {
        id: "corpus_edit_dismiss_edit",
        label: dismissLabel,
        prompt: corpusEditDismissEditPrompt(targetPath),
        displayText: dismissLabel,
      },
    ],
  };
};

export const buildCorpusEditOpenAnswer = (
  repoPath: string,
  content: string,
  language: "zh" | "en" = "zh"
): string => {
  const body = content.trim()
    ? content
    : language === "en"
      ? "(empty)"
      : "（空文件）";
  if (language === "en") {
    return [
      `Opened ${repoPath} (preview only; not written).`,
      "Click Edit to change in the dual-mode editor, then confirm update.",
      "To clear: ask to clear this path (HITL confirm). Physical delete is not supported.",
      "",
      "--- current ---",
      body,
    ].join("\n");
  }
  return [
    `已打开 ${repoPath}（仅预览，未写入）。`,
    "点「编辑此文件」可在双模式编辑器中修改，提交后需再确认更新。",
    "若要清空：请明确要求清空该路径（仍须确认）。不支持物理删除。",
    "",
    "--- 当前内容 ---",
    body,
  ].join("\n");
};

/** 查/打开后：进入编辑（方案 C） */
export const buildCorpusEditOpenActions = (
  targetPath: string,
  language: "zh" | "en" = "zh"
): AssistantMessageBlock => ({
  type: "actions",
  actions: [
    {
      id: "corpus_edit_open",
      label: language === "en" ? "Edit file" : "编辑此文件",
      prompt: corpusEditOpenFilePrompt(targetPath),
      displayText: language === "en" ? "Edit file" : "编辑此文件",
      clientHandler: "open_editor",
    },
  ],
});

export const buildCorpusEditDismissEditAnswer = (
  targetPath: string,
  language: "zh" | "en" = "zh"
): string => {
  if (language === "en") {
    return `Edit session closed for ${targetPath}. The file on disk is unchanged by this step.`;
  }
  return `已结束编辑询问（${targetPath}）。磁盘文件保持现状；之后可再打开该路径编辑。`;
};
