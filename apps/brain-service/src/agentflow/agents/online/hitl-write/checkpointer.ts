/**
 * HITL 子图 checkpointer：独立 SQLite（非 Prisma / 非 Mem0 history）。
 * 主 Pipeline 不使用 checkpointer。
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { findMonorepoRoot } from "@fambrain/corpus";

let saver: SqliteSaver | null = null;

export const resolveHitlCheckpointDbPath = (): string => {
    const fromEnv = process.env.LANGGRAPH_CHECKPOINT_DB_PATH?.trim();
    if (fromEnv) return path.resolve(fromEnv);
    return path.join(
        findMonorepoRoot(),
        "data/memory/langgraph/checkpoints.db"
    );
};

export const getHitlCheckpointer = (): SqliteSaver => {
    if (!saver) {
        const dbPath = resolveHitlCheckpointDbPath();
        mkdirSync(path.dirname(dbPath), { recursive: true });
        saver = SqliteSaver.fromConnString(dbPath);
    }
    return saver;
};
