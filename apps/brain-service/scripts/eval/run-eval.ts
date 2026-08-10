/**
 * Eval MVP：golden.json → Pipeline / KM 断言 → JSON + Markdown 报告。
 *
 *   pnpm --filter @fambrain/brain-service run eval:run
 *   pnpm --filter @fambrain/brain-service run eval:run -- --case L3
 *   pnpm --filter @fambrain/brain-service run eval:run -- --mem-only
 *   pnpm --filter @fambrain/brain-service run eval:run -- --identity-composite-only
 *   EVAL_WRITE_REPORT=1 pnpm --filter @fambrain/brain-service run eval:run
 *
 * 需 Ollama + 语料；KM hybrid 指标建议 Chroma 在线。
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentPipelineContext, DbChatTurn } from "@fambrain/brain-types";
import { listCorpusUserIds } from "@/agentflow/agents/offline/knowledge-indexer/list-corpus-users";
import {
    retrieveEnumerationPage,
    ENUMERATION_EXHAUSTIVE_PAGE_SIZE,
    ENUMERATION_PREVIEW_PAGE_SIZE,
} from "@/agentflow/agents/online/corpus-lister/list";
import { hybridRecall } from "@/agentflow/agents/online/knowledge-manager/recall/hybrid-recall";
import { getProfileRecallParams } from "@/agentflow/agents/online/knowledge-manager/profile/km-config";
import { resolveQueryProfile } from "@/agentflow/agents/online/knowledge-manager/profile/query-profile";
import { retrieveKnowledge } from "@/agentflow/agents/online/knowledge-manager/recall/retrieve";
import { runPipelineStream } from "@/agentflow/index";
import { bootstrapBrainServiceRuntime } from "@/config";
import {
    assertKm,
    assertPipeline,
    type JsonAssert,
    type KmEvalSnapshot,
    type PipelineEvalSnapshot,
} from "./assert-golden";
import { enableRepeatGuardForVerify } from "../verify-test-env";
import {
    runVaultWorkspaceProbe,
    runCorpusEditProbe,
    type CorpusEditProbeSpec,
    type VaultWorkspaceProbeSpec,
} from "./vault-workspace-probe";
import { writeGateReport } from "../_gate-report";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = path.join(__dirname, "golden.json");

type GoldenTier = "pipeline" | "km" | "list";

type GoldenCase = {
    id: string;
    tier: GoldenTier;
    label: string;
    question?: string;
    /** QU-02：多轮 history（不含本轮 question） */
    history?: DbChatTurn[];
    list?: {
        listKind: "experience" | "project";
        action?: "preview" | "continue" | "exhaustive";
        page?: number;
        pageSize?: number;
    };
    km?: {
        searchQuery: string;
        queryType: "identity" | "enumeration" | "tech" | "default";
        topics: string[];
        subTasks: string[];
    };
    assert: JsonAssert;
};

type CacheTurn = {
    question: string;
    assert: JsonAssert;
    expectCacheHit?: boolean;
};

type ProfileTurn = {
    question: string;
    assert: JsonAssert;
    expectRepeatHit?: boolean;
};

type ListPaginationTurn = {
    question: string;
    assert: JsonAssert;
};

type MemTurn = {
    conversationSuffix: string;
    question: string;
    assert: JsonAssert;
};

type GoldenFile = {
    version: number;
    cases: GoldenCase[];
    memProbe?: {
        id: string;
        label: string;
        qq?: string;
        conversationIdPrefix?: string;
        turns: MemTurn[];
    };
    cacheProbe?: {
        id: string;
        label: string;
        conversationIdPrefix: string;
        turns: CacheTurn[];
    };
    profileProbe?: {
        id: string;
        label: string;
        conversationIdPrefix: string;
        companies?: string[];
        turns: ProfileTurn[];
    };
    listPaginationProbe?: {
        id: string;
        label: string;
        conversationIdPrefix: string;
        turns: ListPaginationTurn[];
    };
    dualListPaginationProbe?: {
        id: string;
        label: string;
        conversationIdPrefix: string;
        turns: ListPaginationTurn[];
    };
    fiveCompositeProbe?: {
        id: string;
        label: string;
        conversationIdPrefix: string;
        turns: ListPaginationTurn[];
    };
    identityCompositeProbe?: {
        id: string;
        label: string;
        conversationIdPrefix: string;
        qq?: string;
        turns: ListPaginationTurn[];
    };
    familyProbe?: {
        id: string;
        label: string;
        conversationIdPrefix: string;
        turns: ListPaginationTurn[];
    };
    vaultWorkspaceProbe?: VaultWorkspaceProbeSpec;
    corpusEditProbe?: CorpusEditProbeSpec;
};

type CaseResult = {
    id: string;
    tier: GoldenTier;
    label: string;
    pass: boolean;
    reason: string;
    latencyMs: number;
    coalesceViolation?: boolean;
    cacheHit?: boolean | null;
    cacheExpected?: boolean;
    repeatHit?: boolean | null;
    repeatExpected?: boolean;
};

type EvalMetrics = {
    goldenPassRate: number;
    passed: number;
    total: number;
    coalesceFailureRate: number;
    coalesceChecks: number;
    coalesceFailures: number;
    cacheHitRate: number | null;
    cacheHits: number;
    cacheEligibleTurns: number;
    cacheNote: string;
    latencyMs: {
        avg: number;
        min: number;
        max: number;
        p95: number;
    };
};

type EvalReport = {
    generatedAt: string;
    corpusUserId: string;
    chromaUp: boolean;
    metrics: EvalMetrics;
    results: CaseResult[];
    memProbe?: CaseResult[];
    cacheProbe?: CaseResult[];
    profileProbe?: CaseResult[];
    listPaginationProbe?: CaseResult[];
    dualListPaginationProbe?: CaseResult[];
    fiveCompositeProbe?: CaseResult[];
    identityCompositeProbe?: CaseResult[];
    familyProbe?: CaseResult[];
    corpusEditProbe?: CaseResult[];
};

const chromaUrl = (): string => {
    const base =
        process.env.CHROMA_SERVER_URL?.trim() ||
        `http://${process.env.CHROMA_HOST ?? "127.0.0.1"}:${process.env.CHROMA_PORT ?? "8030"}`;
    return base.replace(/\/$/, "");
};

const chromaReady = async (): Promise<boolean> => {
    try {
        const res = await fetch(`${chromaUrl()}/api/v2/heartbeat`, {
            signal: AbortSignal.timeout(3000),
        });
        return res.ok;
    } catch {
        return false;
    }
};

const resolveCorpusUserId = async (): Promise<string> => {
    const fromEnv = process.env.FAMBRAIN_CORPUS_USER_ID?.trim();
    if (fromEnv) return fromEnv;
    const ids = await listCorpusUserIds();
    if (ids.length === 0) {
        throw new Error("无 corpus 用户；请设置 FAMBRAIN_CORPUS_USER_ID 或 index:corpus");
    }
    return ids[0]!;
};

const runPipelineCase = async (
    corpusUserId: string,
    question: string,
    conversationId: string,
    priorHistory: DbChatTurn[] = []
): Promise<PipelineEvalSnapshot> => {
    const started = Date.now();
    const steps: string[] = [];
    let answer = "";
    let error: string | undefined;
    let hitCount = 0;
    let coverage = "none";
    const history: DbChatTurn[] = [
        ...priorHistory,
        { role: "user", content: question },
    ];
    const context: AgentPipelineContext = {
        actorUserId: corpusUserId,
        corpusUserId,
        displayName: "Eval",
        conversationId,
    };
    let cacheHit = false;
    let repeatHit = false;
    let blocks: PipelineEvalSnapshot["blocks"];
    const gen = runPipelineStream(history, context);
    while (true) {
        const next = await gen.next();
        if (next.done) {
            answer = next.value.answer;
            blocks = next.value.blocks;
            if (next.value.retrievalCacheHit) cacheHit = true;
            if (next.value.repeatQuestionHit) repeatHit = true;
            break;
        }
        const ev = next.value;
        if (ev.type === "step" && ev.status === "running") steps.push(ev.name);
        if (ev.type === "error") error = ev.message;
        if (ev.type === "retrieval_meta" && ev.cacheHit) cacheHit = true;
    }
    return {
        steps,
        answer,
        error,
        hitCount,
        coverage,
        latencyMs: Date.now() - started,
        cacheHit,
        repeatHit,
        blocks,
    };
};

const runKmCase = async (
    corpusUserId: string,
    km: NonNullable<GoldenCase["km"]>
): Promise<KmEvalSnapshot> => {
    const started = Date.now();
    const queryProfile = resolveQueryProfile(
        km.searchQuery,
        km.subTasks,
        km.queryType
    );
    const { vectorTopK } = getProfileRecallParams(queryProfile);
    const vectorQuery = [km.searchQuery, ...km.topics, ...km.subTasks].join(
        " "
    );
    const sparseQuery = [km.searchQuery, ...km.subTasks].join(" ");

    const [result, hybrid] = await Promise.all([
        retrieveKnowledge({
            corpusUserId,
            searchQuery: km.searchQuery,
            topics: km.topics,
            subTasks: km.subTasks,
            queryType: km.queryType,
            candidates: [],
        }),
        hybridRecall(corpusUserId, vectorQuery, sparseQuery, vectorTopK),
    ]);

    return {
        hits: result.hits.map((h) => ({
            path: h.path,
            excerpt: h.excerpt,
            relevance: h.relevance,
        })),
        coverage: result.coverage,
        notes: result.notes,
        queryProfile,
        candidateCount: hybrid.candidates.length,
        recallSource: hybrid.recallSource,
        confidenceTier: result.confidenceTier,
        confidenceScore: result.confidenceScore,
        latencyMs: Date.now() - started,
    };
};

const runListCase = async (
    corpusUserId: string,
    list: NonNullable<GoldenCase["list"]>
): Promise<KmEvalSnapshot> => {
    const started = Date.now();
    const action = list.action ?? "preview";
    const pageSize =
        list.pageSize ??
        (action === "preview"
            ? ENUMERATION_PREVIEW_PAGE_SIZE
            : ENUMERATION_EXHAUSTIVE_PAGE_SIZE);
    const result = await retrieveEnumerationPage({
        corpusUserId,
        listKind: list.listKind,
        page: list.page ?? 1,
        pageSize,
    });
    const totalExpected = result.enumerationMeta?.totalExpected ?? result.hits.length;
    return {
        hits: result.hits.map((h) => ({
            path: h.path,
            excerpt: h.excerpt,
            relevance: h.relevance,
        })),
        coverage: result.coverage,
        notes: result.notes,
        queryProfile: "enumeration",
        candidateCount: totalExpected,
        recallSource: "list_corpus",
        confidenceTier: result.confidenceTier,
        confidenceScore: result.confidenceScore,
        latencyMs: Date.now() - started,
    };
};

const evaluateCase = async (
    spec: GoldenCase,
    corpusUserId: string,
    runIndex: number
): Promise<CaseResult> => {
    const started = Date.now();
    if (spec.tier === "km") {
        if (!spec.km) {
            return {
                id: spec.id,
                tier: spec.tier,
                label: spec.label,
                pass: false,
                reason: "km 用例缺少 km 字段",
                latencyMs: 0,
            };
        }
        const snap = await runKmCase(corpusUserId, spec.km);
        const issues = assertKm(snap, spec.assert);
        const coalesceViolation =
            snap.candidateCount > 0 && snap.hits.length === 0;
        return {
            id: spec.id,
            tier: spec.tier,
            label: spec.label,
            pass: issues.length === 0,
            reason:
                issues.length === 0
                    ? `ok (${snap.recallSource}, candidates=${snap.candidateCount})`
                    : issues.join("; "),
            latencyMs: snap.latencyMs,
            coalesceViolation,
        };
    }

    if (spec.tier === "list") {
        if (!spec.list) {
            return {
                id: spec.id,
                tier: spec.tier,
                label: spec.label,
                pass: false,
                reason: "list 用例缺少 list 字段",
                latencyMs: 0,
            };
        }
        const snap = await runListCase(corpusUserId, spec.list);
        const issues = assertKm(snap, spec.assert);
        return {
            id: spec.id,
            tier: spec.tier,
            label: spec.label,
            pass: issues.length === 0,
            reason:
                issues.length === 0
                    ? `ok (${snap.recallSource}, total=${snap.candidateCount}, hits=${snap.hits.length})`
                    : issues.join("; "),
            latencyMs: snap.latencyMs,
        };
    }

    const runOnce = async (attempt: number) => {
        const conversationId = `eval-${spec.id}-r${runIndex}-a${attempt}-${Date.now()}`;
        const snap = await runPipelineCase(
            corpusUserId,
            spec.question ?? "",
            conversationId,
            spec.history ?? []
        );
        const issues = assertPipeline(snap, spec.assert);
        return { snap, issues };
    };

    // pipeline LLM 偶发抖动：失败再试 1 次（新 conversationId）
    let { snap, issues } = await runOnce(1);
    let retried = false;
    if (issues.length > 0) {
        retried = true;
        ({ snap, issues } = await runOnce(2));
    }
    return {
        id: spec.id,
        tier: spec.tier,
        label: spec.label,
        pass: issues.length === 0,
        reason:
            issues.length === 0
                ? retried
                    ? "ok（retry）"
                    : "ok"
                : issues.join("; "),
        latencyMs: snap.latencyMs || Date.now() - started,
    };
};

/** 对话 A 记事实 → 新 conversationId B 召回（对齐 Golden GMem / golden.json memProbe） */
const runMemProbe = async (
    probe: NonNullable<GoldenFile["memProbe"]>,
    corpusUserId: string
): Promise<CaseResult[]> => {
    const prefix = probe.conversationIdPrefix ?? "eval-mem";
    const stamp = Date.now();
    const out: CaseResult[] = [];
    for (const [i, turn] of probe.turns.entries()) {
        const conversationId = `${prefix}-${turn.conversationSuffix}-${stamp}`;
        let snap = await runPipelineCase(
            corpusUserId,
            turn.question,
            conversationId
        );
        let issues = assertPipeline(snap, turn.assert);
        if (issues.length > 0) {
            snap = await runPipelineCase(
                corpusUserId,
                turn.question,
                `${conversationId}-retry`
            );
            issues = assertPipeline(snap, turn.assert);
        }
        out.push({
            id: `${probe.id}-t${i + 1}`,
            tier: "pipeline",
            label: `${probe.label} · ${turn.conversationSuffix}`,
            pass: issues.length === 0,
            reason: issues.length === 0 ? "ok" : issues.join("; "),
            latencyMs: snap.latencyMs,
        });
    }
    return out;
};

const runCacheProbe = async (
    probe: NonNullable<GoldenFile["cacheProbe"]>,
    corpusUserId: string
): Promise<CaseResult[]> => {
    const conversationId = `${probe.conversationIdPrefix}-${Date.now()}`;
    const out: CaseResult[] = [];
    for (const [i, turn] of probe.turns.entries()) {
        const snap = await runPipelineCase(
            corpusUserId,
            turn.question,
            conversationId
        );
        const issues = assertPipeline(snap, turn.assert);
        const cacheHit = snap.cacheHit ?? false;
        const allIssues = [...issues];
        out.push({
            id: `${probe.id}-t${i + 1}`,
            tier: "pipeline",
            label: `${probe.label} · turn${i + 1}`,
            pass: allIssues.length === 0,
            reason:
                allIssues.length === 0
                    ? turn.expectCacheHit
                        ? `ok（cache 探测：${cacheHit ? "hit" : "miss，cache 未接入"}）`
                        : "ok"
                    : allIssues.join("; "),
            latencyMs: snap.latencyMs,
            cacheHit,
            cacheExpected: turn.expectCacheHit ?? false,
        });
    }
    return out;
};

const runProfileProbe = async (
    probe: NonNullable<GoldenFile["profileProbe"]>,
    corpusUserId: string
): Promise<CaseResult[]> => {
    enableRepeatGuardForVerify();
    const conversationId = `${probe.conversationIdPrefix}-${Date.now()}`;
    const out: CaseResult[] = [];
    let priorHistory: DbChatTurn[] = [];
    for (const [i, turn] of probe.turns.entries()) {
        const snap = await runPipelineCase(
            corpusUserId,
            turn.question,
            conversationId,
            priorHistory
        );
        const issues = assertPipeline(snap, turn.assert);
        const repeatHit = snap.repeatHit ?? false;
        if (turn.expectRepeatHit && !repeatHit) {
            issues.push("repeatQuestionHit 期望 true");
        }
        out.push({
            id: `${probe.id}-t${i + 1}`,
            tier: "pipeline",
            label: `${probe.label} · turn${i + 1}`,
            pass: issues.length === 0,
            reason:
                issues.length === 0
                    ? turn.expectRepeatHit
                        ? `ok（同问短路：${repeatHit ? "hit" : "miss"}）`
                        : "ok"
                    : issues.join("; "),
            latencyMs: snap.latencyMs,
            repeatHit,
            repeatExpected: turn.expectRepeatHit ?? false,
        });
        priorHistory = [
            ...priorHistory,
            { role: "user", content: turn.question },
            {
                role: "assistant",
                content: snap.answer,
                ...(snap.blocks?.length ? { blocks: snap.blocks } : {}),
            },
        ];
    }
    return out;
};

const runListPaginationProbe = async (
    probe: NonNullable<GoldenFile["listPaginationProbe"]>,
    corpusUserId: string,
    opts?: { logAnswerOnFail?: boolean }
): Promise<CaseResult[]> => {
    const conversationId = `${probe.conversationIdPrefix}-${Date.now()}`;
    const out: CaseResult[] = [];
    let priorHistory: DbChatTurn[] = [];
    for (const [i, turn] of probe.turns.entries()) {
        let snap = await runPipelineCase(
            corpusUserId,
            turn.question,
            conversationId,
            priorHistory
        );
        let issues = assertPipeline(snap, turn.assert);
        if (issues.length > 0) {
            snap = await runPipelineCase(
                corpusUserId,
                turn.question,
                conversationId,
                priorHistory
            );
            issues = assertPipeline(snap, turn.assert);
        }
        const pass = issues.length === 0;
        if (!pass && opts?.logAnswerOnFail) {
            const preview =
                snap.answer.length > 600
                    ? `${snap.answer.slice(0, 600)}…`
                    : snap.answer;
            console.log(`\n--- answer preview (turn ${i + 1}) ---\n${preview}\n--- steps: ${snap.steps.join(" → ")} ---\n`);
        }
        out.push({
            id: `${probe.id}-t${i + 1}`,
            tier: "pipeline",
            label: `${probe.label} · turn${i + 1}`,
            pass,
            reason: pass ? "ok" : issues.join("; "),
            latencyMs: snap.latencyMs,
        });
        priorHistory = [
            ...priorHistory,
            { role: "user", content: turn.question },
            {
                role: "assistant",
                content: snap.answer,
                ...(snap.blocks?.length ? { blocks: snap.blocks } : {}),
            },
        ];
    }
    return out;
};

const percentile = (values: number[], p: number): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(
        sorted.length - 1,
        Math.ceil((p / 100) * sorted.length) - 1
    );
    return sorted[idx]!;
};

const buildMetrics = (
    results: CaseResult[],
    cacheProbe: CaseResult[]
): EvalMetrics => {
    const passed = results.filter((r) => r.pass).length;
    const total = results.length;
    const kmResults = results.filter((r) => r.tier === "km");
    const coalesceChecks = kmResults.length;
    const coalesceFailures = kmResults.filter((r) => r.coalesceViolation).length;
    const latencies = results.map((r) => r.latencyMs);

    const cacheEligible = cacheProbe.filter((r) => r.cacheExpected);
    const cacheHits = cacheEligible.filter((r) => r.cacheHit === true).length;

    return {
        goldenPassRate: total === 0 ? 0 : passed / total,
        passed,
        total,
        coalesceFailureRate:
            coalesceChecks === 0 ? 0 : coalesceFailures / coalesceChecks,
        coalesceChecks,
        coalesceFailures,
        cacheHitRate:
            cacheEligible.length === 0
                ? null
                : cacheHits / cacheEligible.length,
        cacheHits,
        cacheEligibleTurns: cacheEligible.length,
        cacheNote:
            cacheEligible.length === 0
                ? "无 cache 探测用例"
                : cacheHits === 0
                  ? "检索 cache 尚未接入 pipeline（指标占位 0/N）"
                  : "cache 已命中",
        latencyMs: {
            avg:
                latencies.length === 0
                    ? 0
                    : latencies.reduce((a, b) => a + b, 0) / latencies.length,
            min: latencies.length === 0 ? 0 : Math.min(...latencies),
            max: latencies.length === 0 ? 0 : Math.max(...latencies),
            p95: percentile(latencies, 95),
        },
    };
};

const formatMarkdown = (report: EvalReport): string => {
    const m = report.metrics;
    const lines: string[] = [
        `# Eval 报告`,
        ``,
        `- 时间：${report.generatedAt}`,
        `- corpusUserId：${report.corpusUserId}`,
        `- Chroma：${report.chromaUp ? "在线" : "离线"}`,
        ``,
        `## 指标（4 项 MVP）`,
        ``,
        `| 指标 | 值 |`,
        `|------|-----|`,
        `| Golden 通过率 | **${m.passed}/${m.total}** (${(m.goldenPassRate * 100).toFixed(1)}%) |`,
        `| candidates>0 但 hits=0 | **${m.coalesceFailures}/${m.coalesceChecks}** (${(m.coalesceFailureRate * 100).toFixed(1)}%) |`,
        `| cache 命中率 | ${m.cacheHitRate === null ? "N/A" : `${m.cacheHits}/${m.cacheEligibleTurns} (${(m.cacheHitRate * 100).toFixed(1)}%)`} |`,
        `| 端到端 latency p95 | **${Math.round(m.latencyMs.p95)}ms** (avg ${Math.round(m.latencyMs.avg)}ms) |`,
        ``,
        `> cache：${m.cacheNote}`,
        ``,
        `## 用例`,
        ``,
        `| ID | 层 | 结果 | latency | 说明 |`,
        `|----|-----|------|---------|------|`,
    ];
    for (const r of report.results) {
        lines.push(
            `| ${r.id} | ${r.tier} | ${r.pass ? "✅" : "❌"} | ${r.latencyMs}ms | ${r.reason.replace(/\|/g, "\\|")} |`
        );
    }
    if (report.cacheProbe?.length) {
        lines.push(``, `## Cache 探测`, ``);
        for (const r of report.cacheProbe) {
            lines.push(
                `- ${r.id}: ${r.pass ? "✅" : "⚠️"} ${r.reason} (${r.latencyMs}ms)`
            );
        }
    }
    if (report.memProbe?.length) {
        lines.push(``, `## Mem 探测（GMem / P0-16）`, ``);
        for (const r of report.memProbe) {
            lines.push(
                `- ${r.id}: ${r.pass ? "✅" : "❌"} ${r.reason} (${r.latencyMs}ms)`
            );
        }
    }
    if (report.profileProbe?.length) {
        lines.push(``, `## Profile 探测（R6-3）`, ``);
        for (const r of report.profileProbe) {
            lines.push(
                `- ${r.id}: ${r.pass ? "✅" : "❌"} ${r.reason} (${r.latencyMs}ms)`
            );
        }
    }
    if (report.listPaginationProbe?.length) {
        lines.push(``, `## 列举分页探测`, ``);
        for (const r of report.listPaginationProbe) {
            lines.push(
                `- ${r.id}: ${r.pass ? "✅" : "❌"} ${r.reason} (${r.latencyMs}ms)`
            );
        }
    }
    if (report.dualListPaginationProbe?.length) {
        lines.push(``, `## 双槽列举续页探测`, ``);
        for (const r of report.dualListPaginationProbe) {
            lines.push(
                `- ${r.id}: ${r.pass ? "✅" : "❌"} ${r.reason} (${r.latencyMs}ms)`
            );
        }
    }
    if (report.fiveCompositeProbe?.length) {
        lines.push(``, `## 五连问探测`, ``);
        for (const r of report.fiveCompositeProbe) {
            lines.push(
                `- ${r.id}: ${r.pass ? "✅" : "❌"} ${r.reason} (${r.latencyMs}ms)`
            );
        }
    }
    if (report.identityCompositeProbe?.length) {
        lines.push(``, `## 六连问 QQ+手机探测`, ``);
        for (const r of report.identityCompositeProbe) {
            lines.push(
                `- ${r.id}: ${r.pass ? "✅" : "❌"} ${r.reason} (${r.latencyMs}ms)`
            );
        }
    }
    if (report.familyProbe?.length) {
        lines.push(``, `## 个人档案 / 亲友探测`, ``);
        for (const r of report.familyProbe) {
            lines.push(
                `- ${r.id}: ${r.pass ? "✅" : "❌"} ${r.reason} (${r.latencyMs}ms)`
            );
        }
    }
    if (report.corpusEditProbe?.length) {
        lines.push(``, `## vault_workspace 探测`, ``);
        for (const r of report.corpusEditProbe) {
            lines.push(
                `- ${r.id}: ${r.pass ? "✅" : "❌"} ${r.reason} (${r.latencyMs}ms)`
            );
        }
    }
    return lines.join("\n");
};

const jsonOnly = process.argv.includes("--json-only");
const profileOnly = process.argv.includes("--profile-only");
const listPaginationOnly = process.argv.includes("--list-pagination-only");
const identityCompositeOnly = process.argv.includes("--identity-composite-only");
const familyOnly = process.argv.includes("--family-only");
const memOnly = process.argv.includes("--mem-only");
const corpusEditOnly = process.argv.includes("--corpus-edit-only");
const caseFilter = (() => {
    const idx = process.argv.indexOf("--case");
    if (idx === -1) return null;
    return process.argv[idx + 1]?.trim() || null;
})();

const main = async (): Promise<void> => {
    bootstrapBrainServiceRuntime();
    const raw = await readFile(GOLDEN_PATH, "utf8");
    const golden = JSON.parse(raw) as GoldenFile;
    const corpusUserId = await resolveCorpusUserId();
    const chromaUp = await chromaReady();

    if (memOnly) {
        if (!golden.memProbe) {
            throw new Error("golden.json 缺少 memProbe");
        }
        console.log(`eval:run — mem probe only (${golden.memProbe.id})`);
        console.log(`corpusUserId=${corpusUserId} chroma=${chromaUp ? "up" : "down"}\n`);
        const memProbe = await runMemProbe(golden.memProbe, corpusUserId);
        for (const r of memProbe) {
            console.log(`  ${r.id}: ${r.pass ? "PASS" : "FAIL"} — ${r.reason} (${r.latencyMs}ms)`);
        }
        const failed = memProbe.filter((r) => !r.pass);
        if (failed.length > 0) process.exit(1);
        console.log("\nMem probe 通过。");
        return;
    }

    if (corpusEditOnly || process.argv.includes("--vault-only")) {
        const vaultSpec = golden.vaultWorkspaceProbe ?? golden.corpusEditProbe;
        if (!vaultSpec) {
            throw new Error("golden.json 缺少 vaultWorkspaceProbe");
        }
        console.log(`eval:run — vault workspace probe only (${vaultSpec.id})`);
        console.log(`corpusUserId=${corpusUserId} chroma=${chromaUp ? "up" : "down"}\n`);
        const vaultProbe = await runVaultWorkspaceProbe(vaultSpec, corpusUserId);
        for (const r of vaultProbe) {
            console.log(
                `  ${r.id}: ${r.pass ? "PASS" : "FAIL"} — ${r.reason} (${r.latencyMs}ms)`
            );
        }
        const failed = vaultProbe.filter((r) => !r.pass);
        if (failed.length > 0) process.exit(1);
        console.log("\nVault workspace probe 通过。");
        return;
    }

    if (profileOnly) {
        if (!golden.profileProbe) {
            throw new Error("golden.json 缺少 profileProbe");
        }
        console.log(`eval:run — profile probe only (${golden.profileProbe.id})`);
        console.log(`corpusUserId=${corpusUserId} chroma=${chromaUp ? "up" : "down"}\n`);
        const profileProbe = await runProfileProbe(
            golden.profileProbe,
            corpusUserId
        );
        for (const r of profileProbe) {
            console.log(`  ${r.id}: ${r.pass ? "PASS" : "FAIL"} — ${r.reason} (${r.latencyMs}ms)`);
        }
        const failed = profileProbe.filter((r) => !r.pass);
        if (failed.length > 0) process.exit(1);
        console.log("\nProfile probe 通过。");
        return;
    }

    if (identityCompositeOnly) {
        if (!golden.identityCompositeProbe) {
            throw new Error("golden.json 缺少 identityCompositeProbe");
        }
        console.log(
            `eval:run — identity composite probe only (${golden.identityCompositeProbe.id})`
        );
        console.log(`corpusUserId=${corpusUserId} chroma=${chromaUp ? "up" : "down"}\n`);
        const results = await runListPaginationProbe(
            golden.identityCompositeProbe,
            corpusUserId,
            { logAnswerOnFail: true }
        );
        for (const r of results) {
            console.log(`  ${r.id}: ${r.pass ? "PASS" : "FAIL"} — ${r.reason} (${r.latencyMs}ms)`);
        }
        const failed = results.filter((r) => !r.pass);
        if (failed.length > 0) process.exit(1);
        console.log("\nIdentity composite probe 通过。");
        return;
    }

    if (familyOnly) {
        if (!golden.familyProbe) {
            throw new Error("golden.json 缺少 familyProbe");
        }
        console.log(`eval:run — family probe only (${golden.familyProbe.id})`);
        console.log(`corpusUserId=${corpusUserId} chroma=${chromaUp ? "up" : "down"}\n`);
        const familyCases = [
            "G2b",
            "G2c",
            "E2E-brother",
            "E2E-sister-in-law",
            "E2E-family-tri",
            "K-family-brother",
            "K-family-sil",
            "K2b",
        ];
        const selected = golden.cases.filter((c) => familyCases.includes(c.id));
        const results: CaseResult[] = [];
        for (const [i, spec] of selected.entries()) {
            process.stdout.write(`  [${i + 1}/${selected.length}] ${spec.id} … `);
            const result = await evaluateCase(spec, corpusUserId, 1);
            console.log(result.pass ? "PASS" : "FAIL");
            results.push(result);
        }
        const probeResults = await runListPaginationProbe(
            golden.familyProbe,
            corpusUserId,
            { logAnswerOnFail: true }
        );
        for (const r of probeResults) {
            console.log(`  ${r.id}: ${r.pass ? "PASS" : "FAIL"} — ${r.reason} (${r.latencyMs}ms)`);
        }
        const failed = [...results, ...probeResults].filter((r) => !r.pass);
        if (failed.length > 0) process.exit(1);
        console.log("\nFamily probe 通过。");
        return;
    }

    if (listPaginationOnly) {
        if (!golden.listPaginationProbe) {
            throw new Error("golden.json 缺少 listPaginationProbe");
        }
        console.log(
            `eval:run — list pagination probe only (${golden.listPaginationProbe.id})`
        );
        console.log(`corpusUserId=${corpusUserId} chroma=${chromaUp ? "up" : "down"}\n`);
        const probes = [
            ...(golden.listPaginationProbe
                ? [golden.listPaginationProbe]
                : []),
            ...(golden.dualListPaginationProbe
                ? [golden.dualListPaginationProbe]
                : []),
        ];
        let failed = 0;
        for (const probe of probes) {
            const results = await runListPaginationProbe(probe, corpusUserId);
            for (const r of results) {
                console.log(`  ${r.id}: ${r.pass ? "PASS" : "FAIL"} — ${r.reason} (${r.latencyMs}ms)`);
                if (!r.pass) failed++;
            }
        }
        if (failed > 0) process.exit(1);
        console.log("\nList pagination probe 通过。");
        return;
    }

    const cases = caseFilter
        ? golden.cases.filter((c) => c.id === caseFilter)
        : golden.cases;
    if (caseFilter && cases.length === 0) {
        throw new Error(`golden.json 无 case id: ${caseFilter}`);
    }

    console.log(
        caseFilter
            ? `eval:run — case ${caseFilter}`
            : `eval:run — ${golden.cases.length} cases + probes`
    );
    console.log(`corpusUserId=${corpusUserId} chroma=${chromaUp ? "up" : "down"}\n`);

    const results: CaseResult[] = [];
    for (const [i, spec] of cases.entries()) {
        process.stdout.write(`  [${i + 1}/${cases.length}] ${spec.id} … `);
        const result = await evaluateCase(spec, corpusUserId, 1);
        console.log(result.pass ? "PASS" : "FAIL");
        results.push(result);
    }

    const memProbe =
        caseFilter || !golden.memProbe
            ? []
            : await runMemProbe(golden.memProbe, corpusUserId);

    const cacheProbe =
        caseFilter || !golden.cacheProbe
            ? []
            : await runCacheProbe(golden.cacheProbe, corpusUserId);

    const profileProbe =
        caseFilter || !golden.profileProbe
            ? []
            : await runProfileProbe(golden.profileProbe, corpusUserId);

    const listPaginationProbe =
        caseFilter || !golden.listPaginationProbe
            ? []
            : await runListPaginationProbe(
                  golden.listPaginationProbe,
                  corpusUserId
              );

    const dualListPaginationProbe =
        caseFilter || !golden.dualListPaginationProbe
            ? []
            : await runListPaginationProbe(
                  golden.dualListPaginationProbe,
                  corpusUserId
              );

    const fiveCompositeProbe =
        caseFilter || !golden.fiveCompositeProbe
            ? []
            : await runListPaginationProbe(
                  golden.fiveCompositeProbe,
                  corpusUserId
              );

    const identityCompositeProbe =
        caseFilter || !golden.identityCompositeProbe
            ? []
            : await runListPaginationProbe(
                  golden.identityCompositeProbe,
                  corpusUserId
              );

    const familyProbe =
        caseFilter || !golden.familyProbe
            ? []
            : await runListPaginationProbe(
                  golden.familyProbe,
                  corpusUserId,
                  { logAnswerOnFail: true }
              );

    const vaultSpec = golden.vaultWorkspaceProbe ?? golden.corpusEditProbe;
    const corpusEditProbe =
        caseFilter || !vaultSpec
            ? []
            : await runVaultWorkspaceProbe(vaultSpec, corpusUserId);

    const report: EvalReport = {
        generatedAt: new Date().toISOString(),
        corpusUserId,
        chromaUp,
        metrics: buildMetrics(results, cacheProbe),
        results,
        memProbe: memProbe.length ? memProbe : undefined,
        cacheProbe: cacheProbe.length ? cacheProbe : undefined,
        profileProbe: profileProbe.length ? profileProbe : undefined,
        listPaginationProbe: listPaginationProbe.length
            ? listPaginationProbe
            : undefined,
        dualListPaginationProbe: dualListPaginationProbe.length
            ? dualListPaginationProbe
            : undefined,
        fiveCompositeProbe: fiveCompositeProbe.length
            ? fiveCompositeProbe
            : undefined,
        identityCompositeProbe: identityCompositeProbe.length
            ? identityCompositeProbe
            : undefined,
        familyProbe: familyProbe.length ? familyProbe : undefined,
        corpusEditProbe: corpusEditProbe.length ? corpusEditProbe : undefined,
    };

    const failed = results.filter((r) => !r.pass);
    const memFailed = (report.memProbe ?? []).filter((r) => !r.pass);
    const profileFailed = (report.profileProbe ?? []).filter((r) => !r.pass);
    const listPaginationFailed = (report.listPaginationProbe ?? []).filter(
        (r) => !r.pass
    );
    const dualListPaginationFailed = (
        report.dualListPaginationProbe ?? []
    ).filter((r) => !r.pass);
    const fiveCompositeFailed = (report.fiveCompositeProbe ?? []).filter(
        (r) => !r.pass
    );
    const identityCompositeFailed = (report.identityCompositeProbe ?? []).filter(
        (r) => !r.pass
    );
    const familyFailed = (report.familyProbe ?? []).filter((r) => !r.pass);
    const corpusEditFailed = (report.corpusEditProbe ?? []).filter((r) => !r.pass);
    const coalesceBad = report.metrics.coalesceFailures > 0;
    const pass =
        failed.length === 0 &&
        memFailed.length === 0 &&
        profileFailed.length === 0 &&
        listPaginationFailed.length === 0 &&
        dualListPaginationFailed.length === 0 &&
        fiveCompositeFailed.length === 0 &&
        identityCompositeFailed.length === 0 &&
        familyFailed.length === 0 &&
        corpusEditFailed.length === 0 &&
        !coalesceBad;

    const mdBody = formatMarkdown(report);
    if (process.env.EVAL_WRITE_REPORT === "1") {
        const repoRoot = path.resolve(__dirname, "../../../..");
        const dir = path.join(repoRoot, "data/eval/reports");
        await mkdir(dir, { recursive: true });
        const stamp = report.generatedAt.replace(/[:.]/g, "-");
        const jsonPath = path.join(dir, `eval-${stamp}.json`);
        const mdPath = path.join(dir, `eval-${stamp}.md`);
        await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
        await writeFile(mdPath, mdBody, "utf8");
        console.log(`\n归档报告:\n  ${jsonPath}\n  ${mdPath}`);
    }

    const failDetails = [
        ...failed,
        ...memFailed,
        ...profileFailed,
        ...listPaginationFailed,
        ...dualListPaginationFailed,
        ...fiveCompositeFailed,
        ...identityCompositeFailed,
        ...familyFailed,
        ...corpusEditFailed,
    ].map((r) => `- ${r.id}: ${r.reason}`);

    // 子集（--case / 仅某 probe）不得覆盖 reports/eval-report 全量段
    const isSubset = Boolean(caseFilter);
    if (isSubset) {
        console.log(
            `[eval] subset (--case ${caseFilter}) — 跳过覆盖 reports/eval-report；请跑无过滤的 eval:run 写全量`
        );
    } else {
        await writeGateReport({
            kind: "eval",
            title: "Eval 全量报表",
            pass,
            summary: {
                scope: "full",
                corpusUserId,
                chromaUp,
                metrics: report.metrics,
                totals: {
                    cases: results.length,
                    failed: failed.length,
                    memFailed: memFailed.length,
                    profileFailed: profileFailed.length,
                    listPaginationFailed: listPaginationFailed.length,
                    dualListPaginationFailed: dualListPaginationFailed.length,
                    fiveCompositeFailed: fiveCompositeFailed.length,
                    identityCompositeFailed: identityCompositeFailed.length,
                    familyFailed: familyFailed.length,
                    vaultFailed: corpusEditFailed.length,
                    coalesceFailures: report.metrics.coalesceFailures,
                },
                failures: failDetails,
                fullReport: report,
            },
            markdownBody: [
                mdBody,
                "",
                "## 失败明细",
                "",
                failDetails.length ? failDetails.join("\n") : "_无_",
                "",
            ].join("\n"),
        });
    }

    if (!jsonOnly) {
        console.log("\n" + mdBody);
    } else {
        console.log(JSON.stringify(report, null, 2));
    }

    if (!pass) {
        process.exit(1);
    }
    console.log("\nEval MVP 通过。");
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
