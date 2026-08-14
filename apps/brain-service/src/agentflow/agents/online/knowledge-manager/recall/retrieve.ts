/**
 * KnowledgeManager 检索：Qdrant hybrid（dense + sparse 引擎 RRF）→ 规则精排输出。
 *
 * 不做 LLM 精排：excerpt / coverage 由确定性规则生成，避免小模型改写 excerpt、
 * 编造 notes，并与业界「检索层不用 Chat LLM、生成留给 Analyst」一致。
 *
 * 向量召回：Qdrant named vector `dense`（nomic-embed-text / cosine）
 * sparse 召回：Qdrant named vector `sparse`（入库 BM25 TF + idf modifier）
 * RRF 融合：Qdrant 引擎加权 RRF（HY-02～03；进程内 fuseRrf 仅单测）
 * 打分与摘录：内存关键词打分 + pickExcerpt（唯一输出路径）
 *
 * KM-01 topics 分流：topics 仅拼入向量 query；sparse 用 searchQuery + subTasks。
 * KM-05 rank：relevance = token + vector/sparse + pathBoost（封顶 1.0）。
 * KM-06 兜底：ensureNonEmptyHits 与 rank 共用 rankCandidates。
 * KM-08/09：queryProfile 分档 vectorTopK / maxHits；Intake queryType 优先。
 * KM-10：表格 excerpt；KM-11：identityGuard。
 * KM-16：同 path merge body。
 * EV-01～04：confidenceTier 分档 + coverage 由 tier 推导 + 低置信弱 coalesce。
 */
import { logAgentIn, logAgentOut } from "@fambrain/brain-shared/agent-log";
import { aggregateFeedbackByPath } from "@fambrain/db";
import type {
    ConfidenceTier,
    KnowledgeCandidate,
    KnowledgeHit,
    KnowledgeManagerInput,
    KnowledgeRetrievalResult,
    QueryProfile,
    RecallSource,
} from "@/agentflow/agents/online/knowledge-manager/contract";
import {
    assessConfidence,
    deriveCoverageFromTier,
    getProfileRecallParams,
    LOG_BODY_PREVIEW,
    MAX_CANDIDATES,
    resolveQueryProfile,
    shouldCoalesceEmptyHits,
    tierNotes,
} from "@/agentflow/agents/online/knowledge-manager/profile";
import { hybridRecall } from "./hybrid-recall";
import {
    applyIdentityGuard,
    applyExternalLinkGuard,
    mergeCandidatesByPath,
    pickExcerpt,
    rankCandidates,
} from "./retrieve-helpers";

type CandidateRow = KnowledgeCandidate;

const summarizeCandidate = (c: CandidateRow, index: number) => ({
    rank: index + 1,
    path: c.path,
    title: c.title,
    bodyChars: c.body.length,
    bodyPreview: c.body.replace(/\s+/g, " ").trim().slice(0, LOG_BODY_PREVIEW),
    score: c.score,
    rawScore: c.rawScore,
    recallChannel: c.recallChannel,
    fusionScore: c.fusionScore,
});

const summarizeRetrievalOut = (
    result: KnowledgeRetrievalResult,
    extra: Record<string, unknown> = {}
) => ({
    hitCount: result.hits.length,
    coverage: result.coverage,
    notes: result.notes,
    paths: result.hits.map((h) => h.path),
    hits: result.hits.map((h, i) => ({
        rank: i + 1,
        path: h.path,
        title: h.title,
        relevance: h.relevance,
        excerptPreview: h.excerpt.slice(0, LOG_BODY_PREVIEW),
    })),
    ...extra,
});

const CJK_RUN = /^[\u4e00-\u9fff]+$/;

const tokenize = (...parts: string[]): string[] => {
    const raw = parts.join(" ").toLowerCase();
    const segments = raw
        .split(/[^a-z0-9\u4e00-\u9fff]+/i)
        .filter((t) => t.length >= 2);
    const expanded: string[] = [];
    for (const t of segments) {
        expanded.push(t);
        if (CJK_RUN.test(t) && t.length > 2) {
            for (let i = 0; i < t.length - 1; i++) {
                expanded.push(t.slice(i, i + 2));
            }
        }
    }
    return [...new Set(expanded)];
};

/** 字面匹配用 token（KM-01：不含 topics，topics 只参与向量 semantic query） */
const tokenizeForRecall = (
    searchQuery: string,
    subTasks: string[] = []
): string[] => tokenize(searchQuery, ...subTasks);

const retrieveByKeywords = (
    input: Pick<KnowledgeManagerInput, "searchQuery" | "subTasks">,
    candidates: CandidateRow[],
    maxHits: number,
    queryProfile: QueryProfile,
    feedbackByPath?: Map<string, number>
): Omit<KnowledgeRetrievalResult, "coverage" | "confidenceTier" | "confidenceScore"> & {
    hits: KnowledgeHit[];
} => {
    const tokens = tokenizeForRecall(input.searchQuery, input.subTasks);
    if (candidates.length === 0) {
        return { hits: [], notes: null };
    }

    const ranked = rankCandidates(
        candidates,
        tokens,
        pickExcerpt,
        queryProfile,
        feedbackByPath
    );
    const scored = ranked.filter((h) => h.relevance > 0);

    const hits: KnowledgeHit[] = scored.slice(0, maxHits).map(
        ({ path: p, title, excerpt, relevance }) => ({
            path: p,
            title,
            excerpt,
            relevance,
        })
    );

    return { hits, notes: null };
};

/** EV-03：低置信不硬塞 Top1；high/mid 仍 coalesce（D3-2）。 */
const ensureNonEmptyHits = (
    input: Pick<KnowledgeManagerInput, "searchQuery" | "subTasks">,
    candidates: CandidateRow[],
    result: KnowledgeRetrievalResult,
    queryProfile: QueryProfile,
    tier: ConfidenceTier,
    topRelevance: number,
    feedbackByPath?: Map<string, number>
): KnowledgeRetrievalResult => {
    if (result.hits.length > 0 || candidates.length === 0) return result;
    if (!shouldCoalesceEmptyHits(tier, topRelevance)) {
        return {
            ...result,
            coverage: "none",
            notes: tierNotes(
                tier,
                "候选非空但置信过低，未强制补选 Top1。"
            ),
        };
    }

    const tokens = tokenizeForRecall(input.searchQuery, input.subTasks);
    const ranked = rankCandidates(
        candidates,
        tokens,
        pickExcerpt,
        queryProfile,
        feedbackByPath
    );
    const top = ranked[0];
    if (!top) return result;

    return {
        ...result,
        hits: [
            {
                path: top.path,
                title: top.title,
                excerpt: top.excerpt,
                relevance: Math.max(0.35, top.relevance),
            },
        ],
        coverage: "partial",
        notes: tierNotes(
            tier,
            "候选非空但 token 未命中，按 token+vector+pathBoost 加权补选。"
        ),
    };
};

const finalizeHits = (
    input: KnowledgeManagerInput,
    candidates: CandidateRow[],
    queryProfile: QueryProfile,
    maxHits: number,
    recallMeta: {
        recallSource: RecallSource;
        topCandidate?: KnowledgeCandidate;
    },
    feedbackByPath?: Map<string, number>
): {
    result: KnowledgeRetrievalResult;
    ranked: ReturnType<typeof rankCandidates>;
    guardApplied: boolean;
    confidenceTier: ConfidenceTier;
    confidenceScore: number;
} => {
    const tokens = tokenizeForRecall(input.searchQuery, input.subTasks);
    const ranked = rankCandidates(
        candidates,
        tokens,
        pickExcerpt,
        queryProfile,
        feedbackByPath
    );

    let result: KnowledgeRetrievalResult = {
        ...retrieveByKeywords(
            input,
            candidates,
            maxHits,
            queryProfile,
            feedbackByPath
        ),
        coverage: "none",
    };

    const provisional = assessConfidence({
        queryProfile,
        hits: result.hits,
        ranked,
        recallSource: recallMeta.recallSource,
        topCandidate: recallMeta.topCandidate ?? candidates[0],
        guardApplied: false,
        candidateCount: candidates.length,
    });

    result = ensureNonEmptyHits(
        input,
        candidates,
        result,
        queryProfile,
        provisional.tier,
        provisional.top1Relevance,
        feedbackByPath
    );

    const guarded = applyIdentityGuard(
        result.hits,
        candidates,
        ranked,
        queryProfile,
        maxHits,
        tokens
    );
    result = { ...result, hits: guarded.hits };

    if (guarded.guardApplied && result.hits[0]) {
        const top = ranked.find((r) => r.path === result.hits[0]!.path);
        if (top) {
            result.hits[0] = {
                ...result.hits[0]!,
                excerpt: pickExcerpt(
                    candidates.find((c) => c.path === top.path)?.body ??
                        top.body,
                    tokens,
                    queryProfile
                ),
            };
        }
    }

    const linkGuarded = applyExternalLinkGuard(
        result.hits,
        candidates,
        ranked,
        queryProfile,
        maxHits,
        tokens
    );
    result = { ...result, hits: linkGuarded.hits };

    const assessment = assessConfidence({
        queryProfile,
        hits: result.hits,
        ranked,
        recallSource: recallMeta.recallSource,
        topCandidate: recallMeta.topCandidate ?? candidates[0],
        guardApplied: guarded.guardApplied,
        candidateCount: candidates.length,
    });
    result = {
        ...result,
        coverage: deriveCoverageFromTier(
            assessment.tier,
            result.hits,
            assessment.top1Relevance
        ),
        notes: tierNotes(assessment.tier, result.notes),
        confidenceTier: assessment.tier,
        confidenceScore: assessment.score,
    };

    return {
        result,
        ranked,
        guardApplied: guarded.guardApplied,
        confidenceTier: result.confidenceTier ?? "low",
        confidenceScore: result.confidenceScore ?? 0,
    };
};

const loadCandidates = async (
    input: KnowledgeManagerInput,
    vectorTopK: number
): Promise<{
    candidates: CandidateRow[];
    recallSource: RecallSource;
    vectorRawCount: number;
    sparseRawCount: number;
    uniquePathCount: number;
    fusionTopPath: string | null;
}> => {
    if (input.candidates.length > 0) {
        const uniquePathCount = new Set(input.candidates.map((c) => c.path)).size;
        return {
            candidates: input.candidates,
            recallSource: "provided",
            vectorRawCount: input.candidates.length,
            sparseRawCount: 0,
            uniquePathCount,
            fusionTopPath: input.candidates[0]?.path ?? null,
        };
    }

    const vectorQuery = [
        input.searchQuery,
        ...input.topics,
        ...input.subTasks,
    ].join(" ");
    const sparseQuery = [input.searchQuery, ...input.subTasks].join(" ");

    const hybrid = await hybridRecall(
        input.corpusUserId,
        vectorQuery,
        sparseQuery,
        vectorTopK
    );

    return {
        candidates: hybrid.candidates,
        recallSource: hybrid.recallSource,
        vectorRawCount: hybrid.vectorRawCount,
        sparseRawCount: hybrid.sparseRawCount,
        uniquePathCount: hybrid.uniquePathCount,
        fusionTopPath: hybrid.candidates[0]?.path ?? null,
    };
};

/**
 * KM 检索主入口：把 Intake 给的 searchQuery / queryType 变成「带摘录的文档片段列表」。
 *
 * 整体像一条流水线，没有 LLM 参与排序或改写摘录：
 *
 *   1. 判断问法类型（queryProfile）→ 决定召回要多宽、最终留几条
 *   2. 去 Qdrant hybrid（dense + sparse RRF）捞候选（或直接用上游已算好的 candidates）
 *   3. 同文件多 chunk 合并
 *   4. 规则打分 + guard + 置信度 → 输出 hits / coverage / notes
 *
 * 下游 Analyst 只读 hits，不再二次检索；所以 KM 的职责是「找对、截好、说清够不够」。
 */
export const retrieveKnowledge = async (
    input: KnowledgeManagerInput
): Promise<KnowledgeRetrievalResult> => {
    // ── ① 问法分档 ──────────────────────────────────────────────────────────
    // Intake 的 queryType（identity / external_link / default…）优先；
    // 否则从 searchQuery + subTasks 推断 profile。
    // profile 决定：向量召回宽度 vectorTopK、最终保留条数 maxHits。
    const queryProfile: QueryProfile = resolveQueryProfile(
        input.searchQuery,
        input.subTasks,
        input.queryType
    );
    const { vectorTopK, maxHits } = getProfileRecallParams(queryProfile);

    logAgentIn("KnowledgeManager", "进入", {
        corpusUserId: input.corpusUserId,
        searchQuery: input.searchQuery,
        topics: input.topics,
        subTasks: input.subTasks,
        queryType: input.queryType ?? null,
        queryProfile,
        vectorTopK,
        maxHits,
        candidatesProvided: input.candidates.length,
    });

    // ── ② 召回候选 ──────────────────────────────────────────────────────────
    // loadCandidates 两条路：
    //   - input.candidates 非空 → 复用（例如 facet 缓存 / 上游已 hybrid）
    //   - 否则 → Qdrant dense + sparse hybrid（引擎 RRF）成候选列表
    const {
        candidates: rawCandidates,
        recallSource,
        vectorRawCount,
        sparseRawCount,
        uniquePathCount,
        fusionTopPath,
    } = await loadCandidates(input, vectorTopK);

    // 同一 markdown 文件可能被切成多个 chunk；按 path 合并 body，避免重复占名额。
    const candidates = mergeCandidatesByPath(
        rawCandidates,
        MAX_CANDIDATES,
        MAX_CANDIDATES
    );

    // ── ③ 空结果早退 ────────────────────────────────────────────────────────
    // 语料里完全找不到相关文档 → 直接 low 置信 + coverage=none，不再走精排。
    if (candidates.length === 0) {
        const empty: KnowledgeRetrievalResult = {
            hits: [],
            coverage: "none",
            notes: null,
            confidenceTier: "low",
            confidenceScore: 0,
        };
        logAgentOut("KnowledgeManager", "出去", summarizeRetrievalOut(empty, {
            recallSource,
            resultSource: "empty",
            vectorRawCount,
            sparseRawCount,
            uniquePathCount,
            fusionTopPath,
            queryProfile,
            vectorTopK,
            maxHits,
            confidenceTier: "low",
            confidenceScore: 0,
        }));
        return empty;
    }

    // ── ④ 用户反馈加权（可选）──────────────────────────────────────────────
    // 从 DB 读该用户历史上点过「有用/无用」的路径；精排时可微调分数。
    // 读失败不影响主流程，退化为空 Map。
    const feedbackByPath = await aggregateFeedbackByPath(input.corpusUserId).catch(
        () => new Map<string, number>()
    );

    // ── ⑤ 规则精排 + guard + 置信度 ─────────────────────────────────────────
    // finalizeHits 内部依次做：
    //   rankCandidates（关键词 + 向量/sparse 分 + pathBoost）
    //   → pickExcerpt 截摘录
    //   → identityGuard / externalLinkGuard 等场景 guard
    //   → assessConfidence 算 tier（high/medium/low）和 coverage
    // 列举类（enumeration）已迁到 corpus-lister，KM 不再在此补全列表。
    const {
        result: ruleResult,
        ranked: topRankedList,
        guardApplied,
        confidenceTier,
        confidenceScore,
    } = finalizeHits(
        input,
        candidates,
        queryProfile,
        maxHits,
        {
            recallSource,
            topCandidate: rawCandidates[0],
        },
        feedbackByPath
    );

    const topRanked = topRankedList[0];

    // ── ⑥ 结构化日志（便于 eval / 线上复盘）────────────────────────────────
    logAgentOut("KnowledgeManager", "出去", summarizeRetrievalOut(ruleResult, {
        recallSource,
        resultSource: "rule",
        vectorRawCount,
        sparseRawCount,
        uniquePathCount,
        fusionTopPath,
        queryProfile,
        vectorTopK,
        maxHits,
        guardApplied,
        confidenceTier,
        confidenceScore,
        fusionScore: rawCandidates[0]?.fusionScore ?? null,
        recallChannel: rawCandidates[0]?.recallChannel ?? null,
        candidateCount: candidates.length,
        candidatesPreview: summarizeCandidate(candidates[0]!, 0),
        topRank: topRanked
            ? {
                  path: topRanked.path,
                  relevance: topRanked.relevance,
                  keywordRelevance: topRanked.keywordRelevance,
                  vectorRelevance: topRanked.vectorRelevance,
                  pathBoost: topRanked.pathBoost,
              }
            : null,
    }));
    return ruleResult;
};
