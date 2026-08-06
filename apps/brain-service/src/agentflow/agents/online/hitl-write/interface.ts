/** HITL 语料修订：提案 / 确认 / 写盘 / 按 path 向量 */

export type CorpusEditOperation = "update" | "clear" | "create";

export type CorpusEditResumeAction = "approve" | "reject";

export type CorpusEditProposalView = {
  proposalId: string;
  threadId: string;
  repoPath: string;
  operation: CorpusEditOperation;
  beforeContent: string;
  afterContent: string;
  status: "pending_review" | "applied" | "rejected";
};

export type CorpusEditApplyResult = {
  ok: boolean;
  proposalId: string;
  repoPath: string;
  indexedChunks: number;
  error?: string;
};
