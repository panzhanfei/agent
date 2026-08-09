import { Queue } from "bullmq";
import { getInfraConfig } from "../config";
import { createRedisConnection, isRedisConfigured } from "../redis/client";
import type { CorpusJobPayload } from "./corpus-job-types";

let queue: Queue<CorpusJobPayload> | null = null;

const getCorpusQueue = (): Queue<CorpusJobPayload> => {
  if (queue) return queue;
  const cfg = getInfraConfig();
  if (!cfg.corpusQueue.enabled) {
    throw new Error("CORPUS_QUEUE_ENABLED 未开启");
  }
  queue = new Queue<CorpusJobPayload>(cfg.corpusQueue.name, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      removeOnComplete: 200,
      removeOnFail: 200,
      attempts: 2,
      backoff: { type: "exponential", delay: 2000 },
    },
  });
  return queue;
};

export const isCorpusQueueEnabled = (): boolean =>
  getInfraConfig().corpusQueue.enabled && isRedisConfigured();

export const enqueueCorpusMaterialize = async (input: {
  corpusUserId: string;
  workspaceRel: string;
}): Promise<{ jobId: string }> => {
  const q = getCorpusQueue();
  const job = await q.add("materialize", {
    kind: "materialize",
    corpusUserId: input.corpusUserId,
    workspaceRel: input.workspaceRel,
  });
  return { jobId: String(job.id) };
};

export const enqueueCorpusPurge = async (input: {
  corpusUserId: string;
  workspaceRels: string[];
}): Promise<{ jobId: string }> => {
  const q = getCorpusQueue();
  const job = await q.add("purge", {
    kind: "purge",
    corpusUserId: input.corpusUserId,
    workspaceRels: input.workspaceRels,
  });
  return { jobId: String(job.id) };
};

export const enqueueCorpusReindexUser = async (input: {
  corpusUserId: string;
}): Promise<{ jobId: string }> => {
  const q = getCorpusQueue();
  const job = await q.add("reindex_user", {
    kind: "reindex_user",
    corpusUserId: input.corpusUserId,
  });
  return { jobId: String(job.id) };
};

export const closeCorpusQueue = async (): Promise<void> => {
  if (!queue) return;
  await queue.close();
  queue = null;
};

/** 压测/观测：等待中的任务数 */
export const getCorpusQueueJobCounts = async (): Promise<{
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
} | null> => {
  if (!isCorpusQueueEnabled()) return null;
  const q = getCorpusQueue();
  const c = await q.getJobCounts("waiting", "active", "delayed", "failed");
  return {
    waiting: c.waiting ?? 0,
    active: c.active ?? 0,
    delayed: c.delayed ?? 0,
    failed: c.failed ?? 0,
  };
};
