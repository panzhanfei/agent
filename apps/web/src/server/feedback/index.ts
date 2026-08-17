import {
  getMessageRetrievalFeedbackSignal,
  upsertRetrievalFeedback,
} from "@fambrain/db";
import { resolveCorpusUserId } from "@/server/knowledge";
import type { FeedbackSignalDto } from "./interface";

export type { FeedbackSignalDto } from "./interface";

export const getOwnMessageFeedbackSignal = async (input: {
  userId: string;
  messageId: string;
}): Promise<FeedbackSignalDto> => {
  const signal = await getMessageRetrievalFeedbackSignal({
    userId: input.userId,
    messageId: input.messageId,
  });
  return { signal };
};

export const submitRetrievalFeedback = async (input: {
  userId: string;
  repoPath: string;
  signal: number;
  corpusUserId?: string;
  conversationId?: string;
  messageId?: string;
  query?: string;
}) => {
  const corpusUserId =
    input.corpusUserId ?? (await resolveCorpusUserId(input.userId));
  return upsertRetrievalFeedback({
    userId: input.userId,
    corpusUserId,
    repoPath: input.repoPath,
    signal: input.signal,
    conversationId: input.conversationId,
    messageId: input.messageId,
    query: input.query,
  });
};
