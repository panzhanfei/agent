/**
 * HY-02～03：RRF 融合 + Hybrid 并行召回验证。
 *
 *   pnpm --filter @fambrain/brain-service run verify:hybrid-recall
 */
import { fuseRrf } from "../src/agentflow/agents/online/knowledge-manager/recall";
import { hybridRecall } from "../src/agentflow/agents/online/knowledge-manager/recall";
import { sparseScoreToRelevance } from "../src/agentflow/agents/online/knowledge-manager/recall";
import { listCorpusUserIds } from "../src/agentflow/agents/offline/knowledge-indexer/list-corpus-users";

const assert = (name: string, fn: () => void) => {
    try {
        fn();
        console.log(`  ✓ ${name}`);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ✗ ${name}: ${msg}`);
        process.exitCode = 1;
    }
};

console.log("verify-hybrid-recall\n— RRF —");

assert("双路均 rank1 的 path 融合分最高", () => {
    const fused = fuseRrf([
        { paths: ["a.md", "b.md", "c.md"] },
        { paths: ["a.md", "c.md", "b.md"] },
    ]);
    if (fused[0]?.path !== "a.md") {
        throw new Error(`Top1 应为 a.md，实际 ${fused[0]?.path}`);
    }
});

assert("仅一路出现的 path 仍入榜", () => {
    const fused = fuseRrf([
        { paths: ["only-sparse.md"] },
        { paths: ["only-vector.md"] },
    ]);
    if (fused.length !== 2) {
        throw new Error(`应有 2 条，实际 ${fused.length}`);
    }
});

assert("weight 加权生效", () => {
    const fused = fuseRrf([
        { paths: ["x.md", "y.md"], weight: 1 },
        { paths: ["y.md", "x.md"], weight: 2 },
    ]);
    if (fused[0]?.path !== "y.md") {
        throw new Error(`加权后 Top1 应为 y.md，实际 ${fused[0]?.path}`);
    }
});

console.log("\n— sparseScoreToRelevance —");

assert("BM25 > 0 映射到 (0,1)", () => {
    const r = sparseScoreToRelevance(8);
    if (r <= 0 || r >= 1) throw new Error(`expected (0,1), got ${r}`);
});

console.log("\n— hybridRecall live —");

const qdrantUrl = (): string => {
    const base =
        process.env.QDRANT_URL?.trim() ||
        `http://${process.env.QDRANT_HOST ?? "127.0.0.1"}:${process.env.QDRANT_PORT ?? "6333"}`;
    return base.replace(/\/$/, "");
};

const qdrantReady = async (): Promise<boolean> => {
    try {
        const res = await fetch(`${qdrantUrl()}/readyz`, {
            signal: AbortSignal.timeout(3000),
        });
        return res.ok;
    } catch {
        return false;
    }
};

const runLive = async () => {
    const fromEnv = process.env.FAMBRAIN_CORPUS_USER_ID?.trim();
    const ids = fromEnv ? [fromEnv] : await listCorpusUserIds();
    if (ids.length === 0) {
        console.log("  (skip) 无 corpus 用户");
        return;
    }
    const corpusUserId = ids[0]!;
    const qdrantUp = await qdrantReady();
    if (!qdrantUp) {
        throw new Error(`Qdrant 未就绪 (${qdrantUrl()})，请 docker compose up -d qdrant 后 index:corpus`);
    }
    const r = await hybridRecall(
        corpusUserId,
        "我的名字是什么",
        "我的名字是什么",
        12
    );
    if (r.sparseRawCount === 0) {
        throw new Error("sparse 路应至少 1 条（请 pnpm index:corpus）");
    }
    if (r.candidates.length === 0) {
        throw new Error("融合后 candidates 不应为空");
    }
    const top = r.candidates[0]!;
    if (!top.recallChannel) {
        throw new Error("candidate 应有 recallChannel");
    }
    if (r.recallSource !== "hybrid") {
        throw new Error(
            `期望 hybrid，实际 ${r.recallSource} (vector=${r.vectorRawCount} sparse=${r.sparseRawCount})`
        );
    }
    if (r.vectorRawCount === 0) {
        throw new Error("Qdrant 在线但 vectorRawCount=0，请 index:corpus");
    }
    console.log(
        `  ✓ hybrid mode corpus=${corpusUserId} source=${r.recallSource} vector=${r.vectorRawCount} sparse=${r.sparseRawCount} top=${top.path}`
    );
};

await runLive().catch((e) => {
    console.error(`  ✗ hybridRecall live: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
});

if (process.exitCode) {
    console.log("\nFAILED");
    process.exit(process.exitCode);
}
console.log("\nOK");
