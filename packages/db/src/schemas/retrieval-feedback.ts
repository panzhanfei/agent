import { z } from "zod";

export const createRetrievalFeedbackSchema = z.object({
  corpusUserId: z.string().min(1).optional(),
  conversationId: z.string().min(1).optional(),
  messageId: z.string().min(1).optional(),
  repoPath: z.string().min(1),
  signal: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  query: z.string().max(2000).optional(),
});
