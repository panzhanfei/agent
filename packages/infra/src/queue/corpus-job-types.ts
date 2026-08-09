/** BullMQ corpus 语料化 / 硬删任务 */

export type CorpusMaterializeJob = {
  kind: "materialize";
  corpusUserId: string;
  workspaceRel: string;
};

export type CorpusPurgeJob = {
  kind: "purge";
  corpusUserId: string;
  workspaceRels: string[];
};

export type CorpusReindexJob = {
  kind: "reindex_user";
  corpusUserId: string;
};

export type CorpusJobPayload =
  | CorpusMaterializeJob
  | CorpusPurgeJob
  | CorpusReindexJob;
