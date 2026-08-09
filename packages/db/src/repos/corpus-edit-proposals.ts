import { prisma } from "../client";
import {
  CorpusEditOperation,
  CorpusEditProposalStatus,
} from "../generated/prisma/client";

export type CreateCorpusEditProposalInput = {
  userId: string;
  corpusUserId: string;
  conversationId?: string | null;
  turnId?: string | null;
  threadId: string;
  repoPath: string;
  operation: "UPDATE" | "CLEAR" | "CREATE";
  beforeContent: string;
  afterContent: string;
};

export const createCorpusEditProposal = async (
  input: CreateCorpusEditProposalInput
) => {
  return prisma.corpusEditProposal.create({
    data: {
      userId: input.userId,
      corpusUserId: input.corpusUserId,
      conversationId: input.conversationId ?? null,
      turnId: input.turnId ?? null,
      threadId: input.threadId,
      repoPath: input.repoPath,
      operation: input.operation as CorpusEditOperation,
      beforeContent: input.beforeContent,
      afterContent: input.afterContent,
      status: CorpusEditProposalStatus.PENDING_REVIEW,
    },
  });
};

export const findCorpusEditProposalForUser = async (
  id: string,
  userId: string
) => {
  return prisma.corpusEditProposal.findFirst({
    where: { id, userId },
  });
};

export const updateCorpusEditProposalStatus = async (
  id: string,
  status: "APPLIED" | "REJECTED" | "EXPIRED"
) => {
  return prisma.corpusEditProposal.update({
    where: { id },
    data: {
      status: status as CorpusEditProposalStatus,
      reviewedAt: new Date(),
    },
  });
};

/** 新开会话 / 会话结束：将该用户全部 PENDING_REVIEW 标为 EXPIRED */
export const expirePendingCorpusEditProposalsForUser = async (
  userId: string
): Promise<number> => {
  const result = await prisma.corpusEditProposal.updateMany({
    where: {
      userId,
      status: CorpusEditProposalStatus.PENDING_REVIEW,
    },
    data: {
      status: CorpusEditProposalStatus.EXPIRED,
      reviewedAt: new Date(),
    },
  });
  return result.count;
};

/** 按 createdAt 将超时 pending 标 EXPIRED（TTL 扫） */
export const expireStalePendingCorpusEditProposals = async (
  olderThan: Date
): Promise<number> => {
  const result = await prisma.corpusEditProposal.updateMany({
    where: {
      status: CorpusEditProposalStatus.PENDING_REVIEW,
      createdAt: { lt: olderThan },
    },
    data: {
      status: CorpusEditProposalStatus.EXPIRED,
      reviewedAt: new Date(),
    },
  });
  return result.count;
};

export const createCorpusFileVersion = async (input: {
  corpusUserId: string;
  repoPath: string;
  content: string;
  sourceProposalId?: string | null;
}) => {
  return prisma.corpusFileVersion.create({
    data: {
      corpusUserId: input.corpusUserId,
      repoPath: input.repoPath,
      content: input.content,
      sourceProposalId: input.sourceProposalId ?? null,
    },
  });
};

export const latestCorpusFileVersion = async (
  corpusUserId: string,
  repoPath: string
) => {
  return prisma.corpusFileVersion.findFirst({
    where: { corpusUserId, repoPath },
    orderBy: { createdAt: "desc" },
  });
};
