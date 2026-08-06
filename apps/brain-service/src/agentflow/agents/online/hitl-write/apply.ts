import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import pino from "pino";
import {
  createCorpusFileVersion,
  updateCorpusEditProposalStatus,
  findCorpusEditProposalForUser,
} from "@fambrain/db";
import { upsertCorpusDocumentsByPath } from "@fambrain/corpus";
import { splitMarkdownToDocuments } from "@/agentflow/agents/offline/knowledge-indexer/split-markdown";
import type { CorpusEditApplyResult } from "./interface";
import { fileExists, resolveCorpusMarkdownAbsPath } from "./paths";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

const PLACEHOLDER_CLEARED = "<!-- fambrain:cleared -->\n";

export const applyCorpusEditProposal = async (input: {
  proposalId: string;
  userId: string;
}): Promise<CorpusEditApplyResult> => {
  const proposal = await findCorpusEditProposalForUser(
    input.proposalId,
    input.userId
  );
  if (!proposal) {
    return {
      ok: false,
      proposalId: input.proposalId,
      repoPath: "",
      indexedChunks: 0,
      error: "proposal_not_found",
    };
  }
  if (proposal.status !== "PENDING_REVIEW") {
    return {
      ok: false,
      proposalId: proposal.id,
      repoPath: proposal.repoPath,
      indexedChunks: 0,
      error: `proposal_status_${proposal.status.toLowerCase()}`,
    };
  }

  const resolved = resolveCorpusMarkdownAbsPath(
    proposal.corpusUserId,
    proposal.repoPath
  );
  if (!resolved) {
    return {
      ok: false,
      proposalId: proposal.id,
      repoPath: proposal.repoPath,
      indexedChunks: 0,
      error: "path_not_allowed",
    };
  }

  try {
    // 写前快照（以磁盘当前为准；无文件则空）
    let diskBefore = "";
    if (await fileExists(resolved.absPath)) {
      diskBefore = await readFile(resolved.absPath, "utf8");
    }
    await createCorpusFileVersion({
      corpusUserId: proposal.corpusUserId,
      repoPath: resolved.repoPath,
      content: diskBefore,
      sourceProposalId: proposal.id,
    });

    const after =
      proposal.operation === "CLEAR"
        ? PLACEHOLDER_CLEARED
        : proposal.afterContent;

    await mkdir(path.dirname(resolved.absPath), { recursive: true });
    await writeFile(resolved.absPath, after, "utf8");

    const fileName = path.basename(resolved.absPath);
    const docs =
      after.trim() && after !== PLACEHOLDER_CLEARED
        ? splitMarkdownToDocuments(
            proposal.corpusUserId,
            resolved.repoPath,
            after,
            fileName
          )
        : [];

    let indexedChunks = 0;
    try {
      const indexed = await upsertCorpusDocumentsByPath(
        proposal.corpusUserId,
        resolved.repoPath,
        docs,
        logger
      );
      indexedChunks = indexed.chunkCount;
    } catch (e) {
      // 盘已写：向量失败不回滚提案；可后续按 path 重试
      const message = e instanceof Error ? e.message : String(e);
      logger.warn(
        { err: message, proposalId: proposal.id, path: resolved.repoPath },
        "corpus edit applied on disk; path vector upsert failed"
      );
    }

    await updateCorpusEditProposalStatus(proposal.id, "APPLIED");

    return {
      ok: true,
      proposalId: proposal.id,
      repoPath: resolved.repoPath,
      indexedChunks,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn({ err: message, proposalId: proposal.id }, "apply corpus edit failed");
    return {
      ok: false,
      proposalId: proposal.id,
      repoPath: proposal.repoPath,
      indexedChunks: 0,
      error: message,
    };
  }
};

export const rejectCorpusEditProposal = async (input: {
  proposalId: string;
  userId: string;
}): Promise<{ ok: boolean; error?: string }> => {
  const proposal = await findCorpusEditProposalForUser(
    input.proposalId,
    input.userId
  );
  if (!proposal) return { ok: false, error: "proposal_not_found" };
  if (proposal.status !== "PENDING_REVIEW") {
    return { ok: false, error: "proposal_not_pending" };
  }
  await updateCorpusEditProposalStatus(proposal.id, "REJECTED");
  return { ok: true };
};
