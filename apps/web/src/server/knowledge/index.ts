import { getUserCorpusUserId } from "@fambrain/db";
import type { CorpusUserId } from "./interface";

export type { CorpusUserId } from "./interface";

export const resolveCorpusUserId = async (
  actorUserId: string
): Promise<CorpusUserId> => {
  const fromEnv = process.env.FAMBRAIN_CORPUS_USER_ID?.trim();
  if (fromEnv) return fromEnv;
  const corpusUserId = await getUserCorpusUserId(actorUserId);
  return corpusUserId || actorUserId;
};
