import { readFile } from "node:fs/promises";
import { createCorpusEditProposal } from "@fambrain/db";
import type { CorpusEditOperation, CorpusEditProposalView } from "./interface";
import {
  fileExists,
  normalizeRepoPath,
  resolveCorpusMarkdownAbsPath,
} from "./paths";

export type ProposeCorpusEditInput = {
  userId: string;
  corpusUserId: string;
  conversationId?: string | null;
  turnId?: string | null;
  threadId: string;
  /** Intake 结构化 path（repo 相对或 corpus 下相对） */
  targetPath: string;
  operation: CorpusEditOperation;
  /** update/create 的正文；clear / create 可空；open 不走 propose */
  afterContent?: string | null;
};

export const proposeCorpusEdit = async (
  input: ProposeCorpusEditInput
): Promise<
  | { ok: true; proposal: CorpusEditProposalView }
  | { ok: false; error: string }
> => {
  if (input.operation === "open") {
    return { ok: false, error: "open_not_writable" };
  }

  const resolved = resolveCorpusMarkdownAbsPath(
    input.corpusUserId,
    input.targetPath
  );
  if (!resolved) {
    return { ok: false, error: "path_not_allowed" };
  }

  const exists = await fileExists(resolved.absPath);
  if (input.operation === "update" || input.operation === "clear") {
    if (!exists) return { ok: false, error: "file_not_found" };
  }
  if (input.operation === "create" && exists) {
    return { ok: false, error: "file_already_exists" };
  }

  let beforeContent = "";
  if (exists) {
    beforeContent = await readFile(resolved.absPath, "utf8");
  }

  let afterContent = (input.afterContent ?? "").toString();
  if (input.operation === "clear") {
    afterContent = "";
  }
  // A：create 允许空文件；C：update 必须有正文（无正文走 slot 预览，不进 propose）
  if (input.operation === "update" && !afterContent.trim()) {
    return { ok: false, error: "empty_after_content" };
  }

  const writeOp = input.operation;
  const row = await createCorpusEditProposal({
    userId: input.userId,
    corpusUserId: input.corpusUserId,
    conversationId: input.conversationId,
    turnId: input.turnId,
    threadId: input.threadId,
    repoPath: resolved.repoPath,
    operation:
      writeOp === "clear"
        ? "CLEAR"
        : writeOp === "create"
          ? "CREATE"
          : "UPDATE",
    beforeContent,
    afterContent,
  });

  return {
    ok: true,
    proposal: {
      proposalId: row.id,
      threadId: row.threadId,
      repoPath: row.repoPath,
      operation: writeOp,
      beforeContent: row.beforeContent,
      afterContent: row.afterContent,
      status: "pending_review",
    },
  };
};

export const parseEditOperation = (raw: unknown): CorpusEditOperation => {
  if (raw === "clear" || raw === "CLEAR") return "clear";
  if (raw === "create" || raw === "CREATE") return "create";
  if (raw === "open" || raw === "OPEN") return "open";
  return "update";
};

export const targetPathFromStep = (step: {
  searchQuery?: string;
  params?: Record<string, unknown> | null;
}): string => {
  const fromParams = step.params?.targetPath ?? step.params?.target_path;
  if (typeof fromParams === "string" && fromParams.trim()) {
    return normalizeRepoPath(fromParams);
  }
  return normalizeRepoPath(step.searchQuery ?? "");
};
