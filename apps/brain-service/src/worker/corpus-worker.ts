/**
 * BullMQ corpus worker：materialize / purge / reindex_user。
 *
 *   pnpm --filter @fambrain/brain-service run dev:corpus-worker
 */
import {
  materializeWorkspaceTxt,
  purgeWorkspaceTxtCascade,
} from "@fambrain/corpus";
import {
  startCorpusWorker,
  stopCorpusWorker,
  type CorpusJobPayload,
} from "@fambrain/infra";
import { indexOneCorpusUser } from "@/agentflow/agents/offline/knowledge-indexer/index-one-user";
import { indexerLogger } from "@/agentflow/agents/offline/knowledge-indexer";
import { bootstrapBrainServiceRuntime } from "@/config/index";

await bootstrapBrainServiceRuntime();

console.log("[corpus-worker] 启动中…");

const handle = async (job: CorpusJobPayload): Promise<void> => {
  switch (job.kind) {
    case "materialize": {
      await materializeWorkspaceTxt({
        corpusUserId: job.corpusUserId,
        workspaceRel: job.workspaceRel,
        indexAfter: true,
        logger: indexerLogger,
      });
      console.log(
        `[corpus-worker] materialize ok user=${job.corpusUserId} rel=${job.workspaceRel}`
      );
      return;
    }
    case "purge": {
      await purgeWorkspaceTxtCascade({
        corpusUserId: job.corpusUserId,
        workspaceRels: job.workspaceRels,
      });
      console.log(
        `[corpus-worker] purge ok user=${job.corpusUserId} n=${job.workspaceRels.length}`
      );
      return;
    }
    case "reindex_user": {
      await indexOneCorpusUser(job.corpusUserId, indexerLogger);
      console.log(`[corpus-worker] reindex_user ok user=${job.corpusUserId}`);
      return;
    }
    default: {
      const _exhaustive: never = job;
      void _exhaustive;
    }
  }
};

startCorpusWorker(handle);

console.log("[corpus-worker] 就绪，等待 BullMQ 任务…");

const shutdown = async () => {
  await stopCorpusWorker();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
