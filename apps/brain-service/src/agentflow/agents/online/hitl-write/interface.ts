/** HITL 语料修订：提案 / 确认 / 写盘 / 按 path 向量 */

/**
 * - update / clear / create：写盘提案（须人批）
 * - open：只读预览（无正文的「修改/打开」；不写盘）
 */
export type CorpusEditOperation = "update" | "clear" | "create" | "open";

export type CorpusEditResumeAction = "approve" | "reject";

export type CorpusEditProposalView = {
  proposalId: string;
  threadId: string;
  repoPath: string;
  operation: Exclude<CorpusEditOperation, "open">;
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
