#!/usr/bin/env node
/**
 * 中档压测基线：
 * 1) 并发打 brain /health
 * 2) 若 CORPUS_QUEUE_ENABLED：批量 enqueue materialize/purge
 * 3) Web 对话全链路：登录 → 会话 → POST /messages（SSE）并发
 *
 * 环境：
 *   LOAD_BASE_URL         brain，默认 http://127.0.0.1:${BRAIN_SERVICE_PORT||3001}
 *   LOAD_CONCURRENCY      health 并发，默认 20
 *   LOAD_REQUESTS         health 请求数，默认 200
 *   LOAD_CORPUS_JOBS      默认 80
 *   LOAD_CHAT_BASE_URL    web，默认 E2E_BASE_URL 或 http://127.0.0.1:3000
 *   LOAD_CHAT_CONCURRENCY 对话并发，默认 3
 *   LOAD_CHAT_REQUESTS    对话请求数，默认 10
 *   LOAD_CHAT_QUESTION    默认「我的名字是什么？」
 *   LOAD_CHAT_ANSWER_RE   可选，命中率写入报表；默认不作为硬失败（LOAD_CHAT_STRICT=1 时硬失败）
 *   LOAD_SKIP_CHAT=1      跳过对话段
 *   FAMBRAIN_CORPUS_USER_ID
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
import { createWebSession } from "../e2e/web-session";

const base = (
  process.env.LOAD_BASE_URL ??
  `http://127.0.0.1:${process.env.BRAIN_SERVICE_PORT ?? "3001"}`
).replace(/\/$/, "");
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? "20");
const total = Number(process.env.LOAD_REQUESTS ?? "200");
const corpusJobs = Number(process.env.LOAD_CORPUS_JOBS ?? "80");
const chatConcurrency = Number(process.env.LOAD_CHAT_CONCURRENCY ?? "3");
const chatTotal = Number(process.env.LOAD_CHAT_REQUESTS ?? "10");
const chatQuestion =
  process.env.LOAD_CHAT_QUESTION?.trim() || "我的名字是什么？";
const chatAnswerReRaw = process.env.LOAD_CHAT_ANSWER_RE?.trim();
const chatAnswerRe = chatAnswerReRaw ? new RegExp(chatAnswerReRaw) : /潘展飞/;
const chatStrict = process.env.LOAD_CHAT_STRICT === "1";
const skipChat = process.env.LOAD_SKIP_CHAT === "1";

const latencies: number[] = [];
let errors = 0;

type QueueSnapshot = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed?: number;
};

type ChatStats = {
  skipped: boolean;
  n: number;
  errors: number;
  emptyAnswers: number;
  patternMiss: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  base: string;
  question: string;
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
  chat: ChatStats;
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

const runBurst = async (
  n: number,
  conc: number,
  worker: () => Promise<void>
): Promise<void> => {
  let inFlight = 0;
  let started = 0;
  await new Promise<void>((resolve) => {
    const kick = () => {
      while (inFlight < conc && started < n) {
        inFlight++;
        started++;
        void worker().finally(() => {
          inFlight--;
          if (started >= n && inFlight === 0) resolve();
          else kick();
        });
      }
    };
    kick();
  });
};

const runHealthBurst = async (): Promise<void> => {
  await runBurst(total, concurrency, one);
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

const runChatLoad = async (): Promise<ChatStats> => {
  const empty: ChatStats = {
    skipped: true,
    n: 0,
    errors: 0,
    emptyAnswers: 0,
    patternMiss: 0,
    avgMs: 0,
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    maxMs: 0,
    base: "",
    question: chatQuestion,
  };
  if (skipChat || chatTotal <= 0) {
    console.log("[load] chat chain skipped (LOAD_SKIP_CHAT or LOAD_CHAT_REQUESTS=0)");
    return empty;
  }

  const chatBase = (
    process.env.LOAD_CHAT_BASE_URL ??
    process.env.E2E_BASE_URL ??
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");

  console.log(
    `[load] chat chain base=${chatBase} concurrency=${chatConcurrency} requests=${chatTotal} q=${JSON.stringify(chatQuestion)}`
  );

  const session = await createWebSession({ base: chatBase });
  const chatLatencies: number[] = [];
  let chatErrors = 0;
  let emptyAnswers = 0;
  let patternMiss = 0;
  let seq = 0;

  await runBurst(chatTotal, chatConcurrency, async () => {
    const i = ++seq;
    const t0 = Date.now();
    try {
      const convId = await session.createConversation(`load-chat-${Date.now()}-${i}`);
      const answer = await session.postChat(convId, chatQuestion);
      if (!answer.trim()) emptyAnswers++;
      else if (!chatAnswerRe.test(answer)) patternMiss++;
    } catch {
      chatErrors++;
    } finally {
      chatLatencies.push(Date.now() - t0);
    }
  });

  const avg =
    chatLatencies.reduce((a, b) => a + b, 0) / Math.max(1, chatLatencies.length);
  const stats: ChatStats = {
    skipped: false,
    n: chatLatencies.length,
    errors: chatErrors,
    emptyAnswers,
    patternMiss,
    avgMs: Number(avg.toFixed(2)),
    p50Ms: percentile(chatLatencies, 50),
    p95Ms: percentile(chatLatencies, 95),
    p99Ms: percentile(chatLatencies, 99),
    maxMs: chatLatencies.length ? Math.max(...chatLatencies) : 0,
    base: chatBase,
    question: chatQuestion,
  };
  console.log(
    `[load] chat n=${stats.n} errors=${stats.errors} empty=${stats.emptyAnswers} patternMiss=${stats.patternMiss} avgMs=${stats.avgMs} p95Ms=${stats.p95Ms}`
  );
  return stats;
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
  const chat = await runChatLoad();

  const errorRate = errors / Math.max(1, latencies.length);
  const queueFailed =
    (corpusQueue.finalCounts?.failed ?? 0) +
    (corpusQueue.purgeFinalCounts?.failed ?? 0);
  const chatErrorRate = chat.skipped
    ? 0
    : (chat.errors + chat.emptyAnswers) / Math.max(1, chat.n);
  const chatPatternFail =
    chatStrict && !chat.skipped && chat.n > 0
      ? chat.patternMiss / chat.n > 0.3
      : false;
  const pass =
    errorRate <= 0.05 &&
    (!corpusQueue.enabled || queueFailed === 0) &&
    (chat.skipped || (chatErrorRate <= 0.15 && !chatPatternFail));

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
    chat,
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
      chatErrorRate,
      ...stats,
    },
    markdownBody: [
      "### 覆盖说明",
      "",
      "- **health**：brain `/health` 并发",
      "- **corpus queue**：materialize/purge 消化",
      "- **chat**：Web 登录 → 会话 → `/messages` SSE（对话全链路）",
      "",
      "### 参数",
      "",
      `| 项 | 值 |`,
      `|---|---|`,
      `| brain base | \`${base}\` |`,
      `| health concurrency | ${concurrency} |`,
      `| health requests | ${total} |`,
      `| corpusJobs | ${corpusJobs} |`,
      `| corpusUserId | \`${corpusUserId}\` |`,
      `| queue enabled | ${corpusQueue.enabled} |`,
      `| chat skipped | ${chat.skipped} |`,
      `| chat base | \`${chat.base || "(n/a)"}\` |`,
      `| chat concurrency | ${chatConcurrency} |`,
      `| chat requests | ${chatTotal} |`,
      `| chat question | ${JSON.stringify(chatQuestion)} |`,
      `| chat strict pattern | ${chatStrict} |`,
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
      "### 对话全链路",
      "",
      chat.skipped
        ? "_已跳过（LOAD_SKIP_CHAT=1 或 LOAD_CHAT_REQUESTS=0）_"
        : [
            `| 指标 | 值 |`,
            `|---|---|`,
            `| n | ${chat.n} |`,
            `| errors | ${chat.errors} |`,
            `| emptyAnswers | ${chat.emptyAnswers} |`,
            `| patternMiss | ${chat.patternMiss} |`,
            `| chatErrorRate | ${(chatErrorRate * 100).toFixed(2)}% |`,
            `| avgMs | ${chat.avgMs} |`,
            `| p50Ms | ${chat.p50Ms} |`,
            `| p95Ms | ${chat.p95Ms} |`,
            `| p99Ms | ${chat.p99Ms} |`,
            `| maxMs | ${chat.maxMs} |`,
          ].join("\n"),
      "",
      "### 判定",
      "",
      `- health errorRate ≤ 5%: ${errorRate <= 0.05 ? "OK" : "FAIL"}`,
      `- queue failed = 0（若启用）: ${!corpusQueue.enabled || queueFailed === 0 ? "OK" : "FAIL"}`,
      `- chat error+empty ≤ 15%（若未跳过）: ${chat.skipped || chatErrorRate <= 0.15 ? "OK" : "FAIL"}`,
      `- chat pattern（仅 STRICT）: ${!chatPatternFail ? "OK" : "FAIL"}`,
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
  console.log("[load] PASS baseline (medium + chat chain)");
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
