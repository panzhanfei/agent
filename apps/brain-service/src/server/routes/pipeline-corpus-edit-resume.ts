import type { IncomingMessage, ServerResponse } from "node:http";
import { findCorpusEditProposalForUser } from "@fambrain/db";
import {
  buildCorpusEditDetailAnswer,
  buildCorpusEditReviewActions,
  resumeCorpusEdit,
} from "@/agentflow/agents/online/hitl-write";
import { requireAuth } from "@/server/middleware";
import { corpusEditResumeBodySchema } from "@/server/schema";
import { readJsonBody } from "@/server/http";

/** POST /pipeline/corpus-edit/resume — approve | reject | detail */
export const handlePipelineCorpusEditResume = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "method not allowed" }));
    return;
  }
  const userId = await requireAuth(req, res);
  if (!userId) return;

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid body";
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg }));
    return;
  }

  const parsed = corpusEditResumeBodySchema.safeParse(body);
  if (!parsed.success) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: parsed.error.message }));
    return;
  }

  const { proposalId, action } = parsed.data;

  if (action === "detail") {
    const proposal = await findCorpusEditProposalForUser(proposalId, userId);
    if (!proposal) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "proposal_not_found" }));
      return;
    }
    const view = {
      proposalId: proposal.id,
      threadId: proposal.threadId,
      repoPath: proposal.repoPath,
      operation:
        proposal.operation === "CLEAR"
          ? ("clear" as const)
          : proposal.operation === "CREATE"
            ? ("create" as const)
            : ("update" as const),
      beforeContent: proposal.beforeContent,
      afterContent: proposal.afterContent,
      status:
        proposal.status === "APPLIED"
          ? ("applied" as const)
          : proposal.status === "REJECTED"
            ? ("rejected" as const)
            : ("pending_review" as const),
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        action: "detail",
        answer: buildCorpusEditDetailAnswer(view),
        blocks:
          proposal.status === "PENDING_REVIEW"
            ? [buildCorpusEditReviewActions(proposal.id)]
            : [],
        proposal: view,
      })
    );
    return;
  }

  const result = await resumeCorpusEdit({
    userId,
    proposalId,
    action,
  });
  if (!result.ok) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: result.error }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      ok: true,
      action,
      applied: result.applied,
      via: result.via,
      result: result.result ?? null,
    })
  );
};
