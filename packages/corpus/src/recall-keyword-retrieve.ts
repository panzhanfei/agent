import { searchCorpusSparse } from "./corpus-vector";

export const SPARSE_EXCERPT_MAX = 320;

export type RecallKeywordHit = {
    path: string;
    title: string;
    body: string;
    excerpt: string;
    score: number;
    recallChannel: "sparse";
};

const pickExcerpt = (body: string, query: string): string => {
    const text = body.replace(/\s+/g, " ").trim();
    if (!text) return "";
    const lower = text.toLowerCase();
    const needle = query.trim().toLowerCase().slice(0, 32);
    let idx = needle ? lower.indexOf(needle) : -1;
    if (idx < 0) {
        const first = query.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
        if (first.length >= 2) idx = lower.indexOf(first);
    }
    if (idx < 0) return text.slice(0, SPARSE_EXCERPT_MAX);
    const start = Math.max(0, idx - 60);
    const slice = text.slice(start, start + SPARSE_EXCERPT_MAX);
    return (
        (start > 0 ? "…" : "") +
        slice +
        (start + SPARSE_EXCERPT_MAX < text.length ? "…" : "")
    );
};

/**
 * Sparse 检索：读 Qdrant 稀疏向量（入库时已写 BM25 TF + idf modifier）。
 * 不再每次查询扫盘建内存 BM25。
 */
export const recallKeywordRetrieve = async (
    corpusUserId: string,
    searchQuery: string,
    topK = 12
): Promise<RecallKeywordHit[]> => {
    const hits = await searchCorpusSparse(corpusUserId, searchQuery, topK);
    return hits.map((h) => ({
        path: h.path,
        title: h.title,
        body: h.body,
        excerpt: pickExcerpt(h.body, searchQuery),
        score: h.score,
        recallChannel: "sparse" as const,
    }));
};

/** HY-01 别名，语义更清晰。 */
export const recallSparseRetrieve = recallKeywordRetrieve;
