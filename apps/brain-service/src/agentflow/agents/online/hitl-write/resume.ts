/**
 * HITL resume：优先 Command 续跑 checkpointer 子图；失败则 DB 直写兜底。
 */
import { findCorpusEditProposalForUser } from "@fambrain/db";
import { applyCorpusEditProposal, rejectCorpusEditProposal } from "./apply";
import { resumeCorpusEditGraph } from "./graph";
import type { CorpusEditApplyResult, CorpusEditResumeAction } from "./interface";

export const resumeCorpusEdit = async (input: {
  userId: string;
  proposalId: string;
  action: CorpusEditResumeAction;
}): Promise<
  | { ok: true; applied: boolean; result?: CorpusEditApplyResult; via: "graph" | "db" }
  | { ok: false; error: string }
> => {
  const proposal = await findCorpusEditProposalForUser(
    input.proposalId,
    input.userId
  );
  if (!proposal) return { ok: false, error: "proposal_not_found" };
  if (proposal.status !== "PENDING_REVIEW") {
    return { ok: false, error: `proposal_status_${proposal.status.toLowerCase()}` };
  }

  try {
    const graphResult = await resumeCorpusEditGraph({
      threadId: proposal.threadId,
      action: input.action,
    });
    if (input.action === "reject") {
      return { ok: true, applied: false, via: "graph" };
    }
    if (graphResult?.applied) {
      return {
        ok: true,
        applied: true,
        via: "graph",
        result: {
          ok: true,
          proposalId: proposal.id,
          repoPath: proposal.repoPath,
          indexedChunks: graphResult.indexedChunks ?? 0,
        },
      };
    }
  } catch {
    // MemorySaver 丢失或 thread 不在本进程 → DB 兜底
  }

  if (input.action === "reject") {
    const rejected = await rejectCorpusEditProposal({
      proposalId: input.proposalId,
      userId: input.userId,
    });
    if (!rejected.ok) return { ok: false, error: rejected.error ?? "reject_failed" };
    return { ok: true, applied: false, via: "db" };
  }

  const applied = await applyCorpusEditProposal({
    proposalId: input.proposalId,
    userId: input.userId,
  });
  if (!applied.ok) return { ok: false, error: applied.error ?? "apply_failed" };
  return { ok: true, applied: true, result: applied, via: "db" };
};
