/**
 * 每会话一件进行中图任务：Checkpointer + thread 世代。
 * 新问 / 生成停 / 显式停止 = 丢弃（世代 +1，旧档不再 Resume）。
 * 原文库 HITL 才 Resume 同一 thread。
 *
 * 生产：官方 SqliteSaver → `data/memory/langgraph/checkpoints.db`
 * 单测：MemorySaver（VITEST 或 resetPipelineCheckpointForTests）
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MemorySaver } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { findMonorepoRoot } from "@fambrain/corpus";
import type { PipelinePauseValue } from "./interface";

export type {
  PipelinePauseKind,
  PipelinePauseValue,
  PipelineResumePayload,
} from "./interface";

type SqliteDb = SqliteSaver["db"];

type GenerationRow = { generation: number };

const generationByConversation = new Map<string, number>();
const discardHooks: Array<(conversationId: string) => void> = [];

let saver: BaseCheckpointSaver | null = null;
let sqliteDb: SqliteDb | null = null;

const isVitest = (): boolean =>
  process.env.VITEST === "true" || Boolean(process.env.VITEST_WORKER_ID);

const useMemoryCheckpointer = (): boolean => {
  const backend = process.env.FAMBRAIN_CHECKPOINT_BACKEND?.trim().toLowerCase();
  if (backend === "memory") return true;
  if (backend === "sqlite") return false;
  return isVitest();
};

const resolveCheckpointDbPath = (): string => {
  const override = process.env.LANGGRAPH_CHECKPOINT_PATH?.trim();
  if (override) {
    return path.isAbsolute(override)
      ? override
      : path.join(findMonorepoRoot(), override);
  }
  return path.join(
    findMonorepoRoot(),
    "data/memory/langgraph/checkpoints.db"
  );
};

const ensureGenerationTable = (db: SqliteDb): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_thread_generation (
      conversation_id TEXT PRIMARY KEY,
      generation INTEGER NOT NULL
    );
  `);
};

const setupSqliteSaver = (dbPath: string): SqliteSaver => {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = SqliteSaver.fromConnString(dbPath);
  (sqlite as unknown as { setup: () => void }).setup();
  sqliteDb = sqlite.db;
  ensureGenerationTable(sqlite.db);
  return sqlite;
};

const ensureSaver = (): BaseCheckpointSaver => {
  if (saver) return saver;
  if (useMemoryCheckpointer()) {
    saver = new MemorySaver();
    sqliteDb = null;
    return saver;
  }
  saver = setupSqliteSaver(resolveCheckpointDbPath());
  return saver;
};

const readGenerationFromSqlite = (conversationId: string): number | null => {
  if (!sqliteDb) return null;
  const row = sqliteDb
    .prepare(
      "SELECT generation FROM pipeline_thread_generation WHERE conversation_id = ?"
    )
    .get(conversationId) as GenerationRow | undefined;
  return row ? row.generation : null;
};

const writeGenerationToSqlite = (
  conversationId: string,
  generation: number
): void => {
  if (!sqliteDb) return;
  sqliteDb
    .prepare(
      `INSERT INTO pipeline_thread_generation (conversation_id, generation)
       VALUES (?, ?)
       ON CONFLICT(conversation_id) DO UPDATE SET generation = excluded.generation`
    )
    .run(conversationId, generation);
};

const currentGeneration = (conversationId: string): number => {
  const cached = generationByConversation.get(conversationId);
  if (cached !== undefined) return cached;
  const persisted = readGenerationFromSqlite(conversationId);
  const gen = persisted ?? 0;
  generationByConversation.set(conversationId, gen);
  return gen;
};

export const registerPipelineDiscardHook = (
  hook: (conversationId: string) => void
): void => {
  discardHooks.push(hook);
};

export const pipelineThreadId = (conversationId: string): string => {
  ensureSaver();
  const gen = currentGeneration(conversationId);
  return `fambrain:${conversationId}:${gen}`;
};

const deleteThreadSafe = (threadId: string): void => {
  const current = saver as
    | (BaseCheckpointSaver & { deleteThread?: (id: string) => Promise<void> })
    | null;
  if (!current?.deleteThread) return;
  void current.deleteThread(threadId).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[checkpoint] deleteThread failed: ${msg}`);
  });
};

/** 新 invoke / 停止前调用：旧 Pause 不可 Resume。 */
export const discardPipelineTask = (conversationId: string): string => {
  ensureSaver();
  const prevId = pipelineThreadId(conversationId);
  const next = currentGeneration(conversationId) + 1;
  generationByConversation.set(conversationId, next);
  writeGenerationToSqlite(conversationId, next);
  deleteThreadSafe(prevId);
  for (const hook of discardHooks) hook(conversationId);
  return pipelineThreadId(conversationId);
};

export const getPipelineCheckpointer = (): BaseCheckpointSaver =>
  ensureSaver();

export const isPipelinePauseValue = (
  value: unknown
): value is PipelinePauseValue => {
  if (!value || typeof value !== "object") return false;
  const v = value as { kind?: unknown; answer?: unknown };
  return (
    (v.kind === "vault_wait" || v.kind === "gen_pause") &&
    typeof v.answer === "string"
  );
};

/** 仅 vault_wait 可 Command Resume；gen_pause 是停。 */
export const isResumablePipelinePause = (
  value: PipelinePauseValue
): value is PipelinePauseValue & { kind: "vault_wait" } =>
  value.kind === "vault_wait";

/** 从 GraphInterrupt / stream `__interrupt__` / getState.tasks 抽出 Pause 载荷 */
export const extractPipelinePauseValue = (
  raw: unknown
): PipelinePauseValue | null => {
  if (isPipelinePauseValue(raw)) return raw;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const found = extractPipelinePauseValue(item);
      if (found) return found;
    }
    return null;
  }
  if (raw && typeof raw === "object") {
    const rec = raw as {
      value?: unknown;
      interrupts?: unknown;
    };
    if (rec.value !== undefined) {
      const found = extractPipelinePauseValue(rec.value);
      if (found) return found;
    }
    if (rec.interrupts !== undefined) {
      return extractPipelinePauseValue(rec.interrupts);
    }
  }
  return null;
};

export const resetPipelineCheckpointForTests = (): void => {
  generationByConversation.clear();
  if (sqliteDb) {
    try {
      sqliteDb.close();
    } catch {
      // already closed
    }
  }
  sqliteDb = null;
  saver = new MemorySaver();
};

/** 单测：用临时 sqlite 验证世代落盘（与生产同一套表） */
export const useSqliteCheckpointerForTests = (dbPath: string): void => {
  generationByConversation.clear();
  if (sqliteDb) {
    try {
      sqliteDb.close();
    } catch {
      // already closed
    }
    sqliteDb = null;
  }
  saver = setupSqliteSaver(dbPath);
};
