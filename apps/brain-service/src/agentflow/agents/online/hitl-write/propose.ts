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
  /** update/create 的正文；clear 可空 */
  afterContent?: string | null;
};

export const proposeCorpusEdit = async (
  input: ProposeCorpusEditInput
): Promise<
  | { ok: true; proposal: CorpusEditProposalView }
  | { ok: false; error: string }
> => {
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
  if (
    (input.operation === "update" || input.operation === "create") &&
    !afterContent.trim()
  ) {
    return { ok: false, error: "empty_after_content" };
  }

  const row = await createCorpusEditProposal({
    userId: input.userId,
    corpusUserId: input.corpusUserId,
    conversationId: input.conversationId,
    turnId: input.turnId,
    threadId: input.threadId,
    repoPath: resolved.repoPath,
    operation:
      input.operation === "clear"
        ? "CLEAR"
        : input.operation === "create"
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
      operation: input.operation,
      beforeContent: row.beforeContent,
      afterContent: row.afterContent,
      status: "pending_review",
    },
  };
};

export const parseEditOperation = (raw: unknown): CorpusEditOperation => {
  if (raw === "clear" || raw === "CLEAR") return "clear";
  if (raw === "create" || raw === "CREATE") return "create";
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
