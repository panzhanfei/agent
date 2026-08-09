/**
 * HITL 提案生命周期：终态不可再批 + pending TTL + 会话切换作废。
 * 时长为结构常量，非口语/场景硬编码。
 */
import {
  expirePendingCorpusEditProposalsForUser,
  findCorpusEditProposalForUser,
  updateCorpusEditProposalStatus,
} from "@fambrain/db";

/** pending 提案超过此时长未处理 → EXPIRED */
export const CORPUS_EDIT_PENDING_TTL_MS = 30 * 60 * 1000;

export type ProposalRow = NonNullable<
  Awaited<ReturnType<typeof findCorpusEditProposalForUser>>
>;

export const isProposalPending = (status: string): boolean =>
  status === "PENDING_REVIEW";

/** 若已超时则标 EXPIRED 并返回更新后的行 */
export const ensureProposalNotStale = async (
  proposal: ProposalRow
): Promise<ProposalRow> => {
  if (!isProposalPending(proposal.status)) return proposal;
  const ageMs = Date.now() - proposal.createdAt.getTime();
  if (ageMs <= CORPUS_EDIT_PENDING_TTL_MS) return proposal;
  await updateCorpusEditProposalStatus(proposal.id, "EXPIRED");
  return { ...proposal, status: "EXPIRED" };
};

export const loadActionableProposal = async (
  proposalId: string,
  userId: string
): Promise<
  | { ok: true; proposal: ProposalRow }
  | { ok: false; error: "proposal_not_found" | "proposal_expired" | string }
> => {
  const found = await findCorpusEditProposalForUser(proposalId, userId);
  if (!found) return { ok: false, error: "proposal_not_found" };
  const proposal = await ensureProposalNotStale(found);
  if (proposal.status === "EXPIRED") {
    return { ok: false, error: "proposal_expired" };
  }
  if (!isProposalPending(proposal.status)) {
    return {
      ok: false,
      error: `proposal_status_${proposal.status.toLowerCase()}`,
    };
  }
  return { ok: true, proposal };
};

/** 新开会话：作废该用户全部 pending 提案 */
export const expirePendingOnNewConversation = async (
  userId: string
): Promise<number> => expirePendingCorpusEditProposalsForUser(userId);
