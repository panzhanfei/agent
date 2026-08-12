/**
 * Corpus 队列 worker 壳：handler 由 brain-service 注入（避免 infra→corpus 依赖）。
 */
import { Worker, type Job } from "bullmq";
import { getInfraConfig } from "../config";
import { bullmqConnection } from "./bullmq-connection";
import type { CorpusJobPayload } from "./corpus-job-types";

export type CorpusJobHandler = (job: CorpusJobPayload) => Promise<void>;

let worker: Worker<CorpusJobPayload> | null = null;

export const startCorpusWorker = (handler: CorpusJobHandler): Worker => {
  if (worker) return worker;
  const cfg = getInfraConfig();
  if (!cfg.corpusQueue.enabled) {
    throw new Error("CORPUS_QUEUE_ENABLED 未开启");
  }
  worker = new Worker<CorpusJobPayload>(
    cfg.corpusQueue.name,
    async (job: Job<CorpusJobPayload>) => {
      await handler(job.data);
    },
    {
      connection: bullmqConnection(),
      concurrency: cfg.corpusQueue.concurrency,
    }
  );
  worker.on("failed", (job, err) => {
    console.error(
      `[corpus-worker] job ${job?.id} failed:`,
      err?.message ?? err
    );
  });
  return worker;
};

export const stopCorpusWorker = async (): Promise<void> => {
  if (!worker) return;
  await worker.close();
  worker = null;
};
