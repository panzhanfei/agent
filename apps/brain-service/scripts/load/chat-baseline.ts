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
import { writeGateReport } from "../_gate-report";

const base = (
  process.env.LOAD_BASE_URL ??
  `http://127.0.0.1:${process.env.BRAIN_SERVICE_PORT ?? "3001"}`
).replace(/\/$/, "");
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? "20");
const total = Number(process.env.LOAD_REQUESTS ?? "200");
const corpusJobs = Number(process.env.LOAD_CORPUS_JOBS ?? "80");

const latencies: number[] = [];
let errors = 0;

type QueueSnapshot = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed?: number;
};

type LoadStats = {
  health: {
    n: number;
    errors: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    maxMs: number;
  };
  corpusQueue: {
    enabled: boolean;
    materializeJobs: number;
    digestMs: number;
    peakBacklog: number;
    finalCounts: QueueSnapshot | null;
    purgeFinalCounts: QueueSnapshot | null;
  };
};

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
  const { listCorpusUserIds } = await import(
    "@/agentflow/agents/offline/knowledge-indexer/list-corpus-users"
  );
  const ids = await listCorpusUserIds();
  if (!ids[0]) throw new Error("无 corpus 用户；请设 FAMBRAIN_CORPUS_USER_ID");
  return ids[0]!;
};

const runCorpusQueueLoad = async (
  corpusUserId: string
): Promise<LoadStats["corpusQueue"]> => {
  if (!isCorpusQueueEnabled()) {
    console.log("[load] corpus queue disabled — skip enqueue burst");
    return {
      enabled: false,
      materializeJobs: 0,
      digestMs: 0,
      peakBacklog: 0,
      finalCounts: null,
      purgeFinalCounts: null,
    };
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
  let finalCounts: QueueSnapshot | null = null;
  for (let i = 0; i < 60; i++) {
    const c = await getCorpusQueueJobCounts();
    if (c) {
      peakWaiting = Math.max(peakWaiting, c.waiting + c.active + c.delayed);
      finalCounts = c;
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
  let purgeFinalCounts: QueueSnapshot | null = null;
  for (let i = 0; i < 60; i++) {
    const c = await getCorpusQueueJobCounts();
    if (c) {
      purgeFinalCounts = c;
      console.log(
        `[load] purge-queue t+${i}s waiting=${c.waiting} active=${c.active} failed=${c.failed}`
      );
      if (c.waiting === 0 && c.active === 0) break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  try {
    const root = getVaultWorkspaceRoot(corpusUserId);
    await rm(path.join(root, folder), { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  console.log(
    `[load] corpus queue digestMs=${digestMs} peakBacklog≈${peakWaiting}`
  );

  return {
    enabled: true,
    materializeJobs: rels.length,
    digestMs,
    peakBacklog: peakWaiting,
    finalCounts,
    purgeFinalCounts,
  };
};

const main = async () => {
  if (/prod|fambrain\.com/i.test(base) && process.env.LOAD_ALLOW_PROD !== "1") {
    throw new Error("拒绝默认压测生产；确认后设 LOAD_ALLOW_PROD=1");
  }
  console.log(
    `[load] base=${base} concurrency=${concurrency} requests=${total} corpusJobs=${corpusJobs}`
  );

  await runHealthBurst();
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const maxMs = latencies.length ? Math.max(...latencies) : 0;
  const avg =
    latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length);
  console.log(
    `[load] health n=${latencies.length} errors=${errors} avgMs=${avg.toFixed(1)} p95Ms=${p95}`
  );

  const corpusUserId = await resolveCorpusUserId();
  const corpusQueue = await runCorpusQueueLoad(corpusUserId);

  const errorRate = errors / Math.max(1, latencies.length);
  const queueFailed =
    (corpusQueue.finalCounts?.failed ?? 0) +
    (corpusQueue.purgeFinalCounts?.failed ?? 0);
  const pass =
    errorRate <= 0.05 &&
    (!corpusQueue.enabled || queueFailed === 0);

  const stats: LoadStats = {
    health: {
      n: latencies.length,
      errors,
      avgMs: Number(avg.toFixed(2)),
      p50Ms: p50,
      p95Ms: p95,
      p99Ms: p99,
      maxMs,
    },
    corpusQueue,
  };

  await writeGateReport({
    kind: "load",
    title: "压测报表（中档）",
    pass,
    summary: {
      base,
      concurrency,
      requests: total,
      corpusJobs,
      corpusUserId,
      errorRate,
      queueFailed,
      ...stats,
    },
    markdownBody: [
      "### 参数",
      "",
      `| 项 | 值 |`,
      `|---|---|`,
      `| base | \`${base}\` |`,
      `| concurrency | ${concurrency} |`,
      `| requests | ${total} |`,
      `| corpusJobs | ${corpusJobs} |`,
      `| corpusUserId | \`${corpusUserId}\` |`,
      `| queue enabled | ${corpusQueue.enabled} |`,
      "",
      "### Health 并发",
      "",
      `| 指标 | 值 |`,
      `|---|---|`,
      `| n | ${stats.health.n} |`,
      `| errors | ${stats.health.errors} |`,
      `| errorRate | ${(errorRate * 100).toFixed(2)}% |`,
      `| avgMs | ${stats.health.avgMs} |`,
      `| p50Ms | ${stats.health.p50Ms} |`,
      `| p95Ms | ${stats.health.p95Ms} |`,
      `| p99Ms | ${stats.health.p99Ms} |`,
      `| maxMs | ${stats.health.maxMs} |`,
      "",
      "### Corpus Queue",
      "",
      corpusQueue.enabled
        ? [
            `| 指标 | 值 |`,
            `|---|---|`,
            `| materializeJobs | ${corpusQueue.materializeJobs} |`,
            `| digestMs | ${corpusQueue.digestMs} |`,
            `| peakBacklog | ${corpusQueue.peakBacklog} |`,
            `| materialize final | \`${JSON.stringify(corpusQueue.finalCounts)}\` |`,
            `| purge final | \`${JSON.stringify(corpusQueue.purgeFinalCounts)}\` |`,
            `| queueFailed | ${queueFailed} |`,
          ].join("\n")
        : "_队列未启用，已跳过 enqueue 段_",
      "",
      "### 判定",
      "",
      `- health errorRate ≤ 5%: ${errorRate <= 0.05 ? "OK" : "FAIL"}`,
      `- queue failed = 0（若启用）: ${!corpusQueue.enabled || queueFailed === 0 ? "OK" : "FAIL"}`,
      "",
    ].join("\n"),
  });

  try {
    await closeCorpusQueue();
  } catch {
    /* ignore */
  }

  if (!pass) {
    console.error("[load] FAIL baseline");
    process.exit(1);
  }
  console.log("[load] PASS baseline (medium)");
  process.exit(0);
};

main().catch(async (e) => {
  console.error(e);
  try {
    await writeGateReport({
      kind: "load",
      title: "压测报表（中档）",
      pass: false,
      summary: { error: e instanceof Error ? e.message : String(e) },
      markdownBody: `### 异常\n\n\`\`\`\n${e instanceof Error ? e.stack ?? e.message : String(e)}\n\`\`\`\n`,
    });
  } catch {
    /* ignore */
  }
  try {
    await closeCorpusQueue();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
