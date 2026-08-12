/**
 * Mem0 + LangMem 本地验证（需 Ollama；Mem0 可设 MEM0_ENABLED=false 仅测 LangMem）。
 * LangMem 摘要落 Prisma Conversation；Mem0 向量落 Chroma 独立 collection。
 *
 *   pnpm run verify:memory
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@fambrain/db";

const main = async () => {
    process.env.MEM0_ENABLED = "false";
    const {
        buildMemoryPromptBlock,
        preparePipelineMemory,
        resetMemoryConfigCache,
        resetMem0Client,
        loadSessionSummary,
        persistSessionSummary,
    } = await import("@fambrain/brain-memory");
    const { summarizeSessionTurns } = await import(
        "@fambrain/brain-memory/langmem"
    );
    resetMemoryConfigCache();
    resetMem0Client();

    const block = buildMemoryPromptBlock({
        sessionSummary: "用户刚问过城管平台技术栈。",
        userMemories: ["偏好简洁中文回答"],
    });
    assert.ok(block);
    assert.ok(block!.includes("LangMem"));
    assert.ok(block!.includes("Mem0"));
    console.log("✓ buildMemoryPromptBlock");

    const summary = await summarizeSessionTurns(null, [
        { role: "user", content: "我是前端开发，主要用 React。" },
        { role: "assistant", content: "好的，已了解你的技术方向。" },
    ]);
    assert.ok(summary.length > 5);
    console.log("✓ LangMem summarizeSessionTurns");

    const convId = `verify-langmem-${randomUUID().replace(/-/g, "").slice(0, 20)}`;
    await prisma.conversation.create({
        data: { id: convId, title: "verify-memory" },
    });
    try {
        // 压低阈值，强制本轮写入摘要
        process.env.LANGMEM_SUMMARIZE_AFTER_TURNS = "2";
        process.env.LANGMEM_KEEP_RECENT_TURNS = "1";
        resetMemoryConfigCache();

        const history = [
            { role: "user" as const, content: "第一轮：问过 React。" },
            { role: "assistant" as const, content: "已记录。" },
            { role: "user" as const, content: "第二轮：还问过 Vue。" },
        ];
        await persistSessionSummary(convId, history, "已合并记录。");
        const loaded = await loadSessionSummary(convId);
        assert.ok(loaded && loaded.length > 2, "Prisma 应有 sessionSummary");
        console.log("✓ LangMem persist/load via Prisma");

        const ctx = await preparePipelineMemory({
            context: {
                actorUserId: "user-test",
                corpusUserId: "user-test",
                displayName: "Test",
                conversationId: convId,
            },
            history: [{ role: "user", content: "你好" }],
            userQuestion: "你好",
        });
        assert.equal(ctx.userMemories.length, 0);
        assert.ok(ctx.sessionSummary && ctx.sessionSummary.length > 0);
        assert.ok(Array.isArray(ctx.intakeHistory));
        console.log("✓ preparePipelineMemory (Mem0 off, LangMem from DB)");
    } finally {
        await prisma.conversation.delete({ where: { id: convId } }).catch(() => {});
        delete process.env.LANGMEM_SUMMARIZE_AFTER_TURNS;
        delete process.env.LANGMEM_KEEP_RECENT_TURNS;
        resetMemoryConfigCache();
    }

    console.log("\nverify:memory OK");
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
