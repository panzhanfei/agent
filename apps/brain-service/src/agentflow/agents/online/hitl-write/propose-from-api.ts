/**
 * 编辑器提交：结构化 propose（update/create/clear），返回 pending 按钮。
 * 不经 Intake 口语猜 path。
 */
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import {
  buildCorpusEditPendingActions,
  buildCorpusEditPendingAnswer,
} from "./compose-actions";
import { parseEditOperation, proposeCorpusEdit } from "./propose";
import type { CorpusEditOperation, CorpusEditProposalView } from "./interface";

export const proposeCorpusEditFromApi = async (input: {
  userId: string;
  corpusUserId: string;
  conversationId?: string | null;
  targetPath: string;
  operation: CorpusEditOperation;
  afterContent: string;
}): Promise<
  | {
      ok: true;
      proposal: CorpusEditProposalView;
      answer: string;
      blocks: AssistantMessageBlock[];
    }
  | { ok: false; error: string }
> => {
  const operation = parseEditOperation(input.operation);
  if (operation === "open") {
    return { ok: false, error: "open_not_writable" };
  }
  const threadId = `corpus-edit-api:${input.userId}:${Date.now()}`;
  const proposed = await proposeCorpusEdit({
    userId: input.userId,
    corpusUserId: input.corpusUserId,
    conversationId: input.conversationId,
    threadId,
    targetPath: input.targetPath,
    operation,
    afterContent: input.afterContent,
  });
  if (!proposed.ok) return proposed;

  const answer = buildCorpusEditPendingAnswer(proposed.proposal, "zh");
  const blocks = [
    buildCorpusEditPendingActions(proposed.proposal.proposalId, operation, "zh"),
  ];
  return {
    ok: true,
    proposal: proposed.proposal,
    answer,
    blocks,
  };
};
