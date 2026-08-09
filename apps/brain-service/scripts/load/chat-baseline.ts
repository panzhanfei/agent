#!/usr/bin/env node
/**
 * 中档压测基线：
 * 1) 并发打 brain /health
 * 2) 若 CORPUS_QUEUE_ENABLED：批量 enqueue materialize/purge，观测堆积与消化
 *
 * 环境：
 *   LOAD_BASE_URL       默认 http://127.0.0.1:${BRAIN_SERVICE_PORT||3001}
 *   LOAD_CONCURRENCY    默认 20（中档）
 *   LOAD_REQUESTS       默认 200（中档）
 *   LOAD_CORPUS_JOBS    默认 80（入队 materialize 次数）
 *   FAMBRAIN_CORPUS_USER_ID  压测写入的语料用户（缺省用 e2e 探测）
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  enqueueCorpusMaterialize,
  enqueueCorpusPurge,
  getCorpusQueueJobCounts,
  isCorpusQueueEnabled,
  closeCorpusQueue,
} from "@fambrain/infra";
import {
  createVaultWorkspaceTxt,
  ensureVaultWorkspaceRoot,
  getVaultWorkspaceRoot,
} from "@fambrain/corpus";

const base = (
  process.env.LOAD_BASE_URL ??
  `http://127.0.0.1:${process.env.BRAIN_SERVICE_PORT ?? "3001"}`
).replace(/\/$/, "");
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? "20");
const total = Number(process.env.LOAD_REQUESTS ?? "200");
const corpusJobs = Number(process.env.LOAD_CORPUS_JOBS ?? "80");

const latencies: number[] = [];
let errors = 0;

const one = async (): Promise<void> => {
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/health`);
    if (!res.ok) errors++;
  } catch {
    errors++;
  } finally {
    latencies.push(Date.now() - t0);
  }
};

const percentile = (arr: number[], p: number): number => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[idx]!;
};

const runHealthBurst = async (): Promise<void> => {
  let inFlight = 0;
  let started = 0;
  await new Promise<void>((resolve) => {
    const kick = () => {
      while (inFlight < concurrency && started < total) {
        inFlight++;
        started++;
        void one().finally(() => {
          inFlight--;
          if (started >= total && inFlight === 0) resolve();
          else kick();
        });
      }
    };
    kick();
  });
};

const resolveCorpusUserId = async (): Promise<string> => {
  const fromEnv = process.env.FAMBRAIN_CORPUS_USER_ID?.trim();
  if (fromEnv) return fromEnv;
  // 与 eval 一致：扫 data/doc/users 取第一个
  const { listCorpusUserIds } = await import(
    "@/agentflow/agents/offline/knowledge-indexer/list-corpus-users"
  );
  const ids = await listCorpusUserIds();
  if (!ids[0]) throw new Error("无 corpus 用户；请设 FAMBRAIN_CORPUS_USER_ID");
  return ids[0]!;
};

const runCorpusQueueLoad = async (corpusUserId: string): Promise<void> => {
  if (!isCorpusQueueEnabled()) {
    console.log("[load] corpus queue disabled — skip enqueue burst");
    return;
  }

  const stamp = Date.now().toString(36);
  const folder = `_load_${stamp}`;
  await ensureVaultWorkspaceRoot(corpusUserId);
  const rels: string[] = [];
  for (let i = 0; i < corpusJobs; i++) {
    const name = `j${i}-${stamp}.txt`;
    const created = await createVaultWorkspaceTxt(
      corpusUserId,
      folder,
      name,
      `load body ${i}\n`
    );
    rels.push(created.relativePath);
  }

  console.log(
    `[load] enqueue materialize n=${rels.length} user=${corpusUserId}`
  );
  const t0 = Date.now();
  await Promise.all(
    rels.map((workspaceRel) =>
      enqueueCorpusMaterialize({ corpusUserId, workspaceRel })
    )
  );
  let peakWaiting = 0;
  for (let i = 0; i < 60; i++) {
    const c = await getCorpusQueueJobCounts();
    if (c) {
      peakWaiting = Math.max(peakWaiting, c.waiting + c.active + c.delayed);
      console.log(
        `[load] queue t+${i}s waiting=${c.waiting} active=${c.active} delayed=${c.delayed} failed=${c.failed}`
      );
      if (c.waiting === 0 && c.active === 0 && c.delayed === 0) break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const digestMs = Date.now() - t0;

  console.log(`[load] enqueue purge n=${rels.length}`);
  await enqueueCorpusPurge({ corpusUserId, workspaceRels: rels });
  for (let i = 0; i < 60; i++) {
    const c = await getCorpusQueueJobCounts();
    if (c) {
      console.log(
        `[load] purge-queue t+${i}s waiting=${c.waiting} active=${c.active} failed=${c.failed}`
      );
      if (c.waiting === 0 && c.active === 0) break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 清理负载文件夹（同步删源；md 已由 purge job 处理）
  try {
    const root = getVaultWorkspaceRoot(corpusUserId);
    await rm(path.join(root, folder), { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  console.log(
    `[load] corpus queue digestMs=${digestMs} peakBacklog≈${peakWaiting}`
  );
  await closeCorpusQueue();
};

const main = async () => {
  if (/prod|fambrain\.com/i.test(base) && process.env.LOAD_ALLOW_PROD !== "1") {
    throw new Error("拒绝默认压测生产；确认后设 LOAD_ALLOW_PROD=1");
  }
  console.log(
    `[load] base=${base} concurrency=${concurrency} requests=${total} corpusJobs=${corpusJobs}`
  );

  await runHealthBurst();
  const p95 = percentile(latencies, 95);
  const avg =
    latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length);
  console.log(
    `[load] health n=${latencies.length} errors=${errors} avgMs=${avg.toFixed(1)} p95Ms=${p95}`
  );

  const corpusUserId = await resolveCorpusUserId();
  await runCorpusQueueLoad(corpusUserId);

  if (errors / Math.max(1, latencies.length) > 0.05) {
    process.exit(1);
  }
  console.log("[load] PASS baseline (medium)");
};

main().catch(async (e) => {
  console.error(e);
  try {
    await closeCorpusQueue();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
