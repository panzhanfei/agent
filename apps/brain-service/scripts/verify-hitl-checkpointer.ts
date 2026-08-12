/**
 * HITL SqliteSaver：独立 checkpoints.db 可 put/get（不跑完整 HITL 业务）。
 *
 *   pnpm --filter @fambrain/brain-service run verify:hitl-checkpointer
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const main = async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "fambrain-ckpt-"));
    process.env.LANGGRAPH_CHECKPOINT_DB_PATH = path.join(tmp, "checkpoints.db");

    const { resolveHitlCheckpointDbPath, getHitlCheckpointer } = await import(
        "../src/agentflow/agents/online/hitl-write/checkpointer"
    );

    const dbPath = resolveHitlCheckpointDbPath();
    assert.ok(dbPath.endsWith("checkpoints.db"));
    const saver = getHitlCheckpointer();
    assert.ok(saver);

    const threadId = `verify-thread-${Date.now()}`;
    const writeConfig = {
        configurable: { thread_id: threadId, checkpoint_ns: "" },
    };
    const checkpoint = {
        v: 1,
        id: `ckpt-${Date.now()}`,
        ts: new Date().toISOString(),
        channel_values: { probe: "hitl-sqlite" },
        channel_versions: { probe: 1 },
        versions_seen: {},
    };
    await saver.put(writeConfig, checkpoint as never, {} as never, {} as never);
    const loaded = await saver.getTuple({
        configurable: { thread_id: threadId },
    });
    assert.ok(loaded, "应从 SQLite checkpointer 读回 tuple");
    assert.equal(
        (loaded.checkpoint.channel_values as { probe?: string }).probe,
        "hitl-sqlite"
    );
    console.log("✓ SqliteSaver put/get", dbPath);

    await rm(tmp, { recursive: true, force: true });
    console.log("\nverify:hitl-checkpointer OK");
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
