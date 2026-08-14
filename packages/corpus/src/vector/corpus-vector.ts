import type { Document } from "@langchain/core/documents";
import { OllamaEmbeddings } from "@langchain/ollama";
import type { Logger } from "pino";
import { getBrainServiceConfig } from "@fambrain/brain-config";
import { isCorpusNoisePath } from "../paths";
import {
    CORPUS_DENSE_VECTOR_SIZE,
    DENSE_VECTOR_NAME,
    getQdrantClient,
    getQdrantUrl,
    pointIdFromKey,
    SPARSE_VECTOR_NAME,
    textToSparseVector,
} from "../qdrant";
import {
    getEmbedIndexOptions,
    mapEmbedBatches,
} from "./embed-batches";
import type {
    CorpusHybridHit,
    CorpusHybridSearchResult,
    CorpusVectorHit,
    CorpusVectorIndexResult,
    EmbedIndexOptions,
} from "./interface";

export type {
    CorpusHybridHit,
    CorpusHybridSearchResult,
    CorpusVectorHit,
    CorpusVectorIndexResult,
};

export const corpusCollectionName = (corpusUserId: string): string => {
    return `fambrain_corpus_${corpusUserId}`;
};

export { getQdrantUrl };

export const createOllamaEmbeddings = (): OllamaEmbeddings => {
    const { ollama } = getBrainServiceConfig();
    return new OllamaEmbeddings({
        model: ollama.models.embed,
        baseUrl: ollama.baseUrl,
    });
};

const payloadToHit = (
    score: number,
    payload: Record<string, unknown> | null | undefined
): CorpusVectorHit => ({
    path: String(payload?.path ?? ""),
    title: String(payload?.title ?? ""),
    body: String(payload?.body ?? ""),
    score,
});

const collectionExists = async (collectionName: string): Promise<boolean> => {
    const client = getQdrantClient();
    try {
        const res = await client.collectionExists(collectionName);
        return Boolean(res.exists);
    } catch {
        return false;
    }
};

export const ensureCorpusCollection = async (
    collectionName: string,
    vectorSize = CORPUS_DENSE_VECTOR_SIZE
): Promise<void> => {
    if (await collectionExists(collectionName)) return;
    const client = getQdrantClient();
    await client.createCollection(collectionName, {
        vectors: {
            [DENSE_VECTOR_NAME]: {
                size: vectorSize,
                distance: "Cosine",
            },
        },
        sparse_vectors: {
            [SPARSE_VECTOR_NAME]: {
                modifier: "idf",
            },
        },
    });
    await client.createPayloadIndex(collectionName, {
        field_name: "path",
        field_schema: "keyword",
        wait: true,
    });
};

export const deleteCorpusCollection = async (collectionName: string): Promise<void> => {
    const client = getQdrantClient();
    try {
        await client.deleteCollection(collectionName);
    } catch {
        // 首次入库，collection 不存在
    }
};

export const upsertCorpusDocumentBatch = async (
    collectionName: string,
    corpusUserId: string,
    batch: Document[],
    embeddings: OllamaEmbeddings
): Promise<void> => {
    if (batch.length === 0) return;
    const vectors = await embeddings.embedDocuments(
        batch.map((d) => d.pageContent)
    );
    const client = getQdrantClient();
    await client.upsert(collectionName, {
        wait: true,
        points: batch.map((doc, i) => {
            const path = String(doc.metadata.path ?? "");
            const title = String(doc.metadata.title ?? "");
            const chunkIndex =
                typeof doc.metadata.chunkIndex === "number"
                    ? doc.metadata.chunkIndex
                    : i;
            const dense = vectors[i] ?? [];
            // 同一 point 写两套：dense 管近义，sparse 管字面。查询时 searchCorpusHybrid 对这两套 prefetch。
            const sparse = textToSparseVector(path, title, doc.pageContent);
            return {
                id: pointIdFromKey(`${corpusUserId}:${path}:${chunkIndex}`),
                vector: {
                    [DENSE_VECTOR_NAME]: dense,
                    [SPARSE_VECTOR_NAME]: sparse,
                },
                payload: {
                    path,
                    title,
                    body: doc.pageContent,
                    corpusUserId,
                    chunkIndex,
                },
            };
        }),
    });
};

export const searchCorpusVectors = async (
    corpusUserId: string,
    searchQuery: string,
    topK = 12
): Promise<CorpusVectorHit[]> => {
    const q = searchQuery.trim();
    if (!q) return [];
    const collectionName = corpusCollectionName(corpusUserId);
    if (!(await collectionExists(collectionName))) return [];
    const dense = await createOllamaEmbeddings().embedQuery(q);
    const client = getQdrantClient();
    const res = await client.query(collectionName, {
        query: dense,
        using: DENSE_VECTOR_NAME,
        limit: topK,
        with_payload: true,
    });
    return (res.points ?? [])
        .map((p) => payloadToHit(p.score ?? 0, p.payload as Record<string, unknown>))
        .filter((h) => h.path && !isCorpusNoisePath(h.path));
};

export const searchCorpusSparse = async (
    corpusUserId: string,
    searchQuery: string,
    topK = 12
): Promise<CorpusVectorHit[]> => {
    const sparse = textToSparseVector(searchQuery);
    if (sparse.indices.length === 0) return [];
    const collectionName = corpusCollectionName(corpusUserId);
    if (!(await collectionExists(collectionName))) return [];
    const client = getQdrantClient();
    const res = await client.query(collectionName, {
        query: sparse,
        using: SPARSE_VECTOR_NAME,
        limit: topK,
        with_payload: true,
    });
    return (res.points ?? [])
        .map((p) => payloadToHit(p.score ?? 0, p.payload as Record<string, unknown>))
        .filter((h) => h.path && !isCorpusNoisePath(h.path));
};

/**
 * 语料 hybrid 检索：一次请求里把「近义」和「字面」都搜完，再在 Qdrant 里按名次融合。
 *
 * 入库时每个 chunk 已经同时写了两套向量（见 upsertCorpusDocumentBatch）：
 *   - dense：Ollama nomic-embed-text，768 维，cosine（懂近义词）
 *   - sparse：token → 哈希下标 + 词频 TF，collection 开了 idf（懂「就这几个字」）
 *
 * 查询不再扫盘建内存 BM25。这边只把问句做成同一套 token / embedding 去搜。
 *
 * KM 调用约定（hybridRecall）：
 *   vectorQuery = searchQuery + topics + subTasks
 *   sparseQuery = searchQuery + subTasks（topics 不进字面通道）
 *
 * 三岔：
 *   1. dense、sparse 都能做 → prefetch 两路各 prefetchK 条，引擎加权 RRF，截到 topK
 *   2. 只有 dense（embed 挂了或问句空）→ 单路向量搜
 *   3. 只有 sparse（embed 失败）→ 单路稀疏搜
 */
export const searchCorpusHybrid = async (input: {
    corpusUserId: string;
    vectorQuery: string;
    sparseQuery: string;
    topK?: number;
    prefetchK?: number;
    rrfK?: number;
    /** 与 prefetch 顺序一致：[dense 权重, sparse 权重]；KM 默认 0.85 / 1.2，偏字面 */
    rrfWeights?: [number, number];
}): Promise<CorpusHybridSearchResult> => {
    const topK = input.topK ?? 12;
    const prefetchK = input.prefetchK ?? Math.max(topK * 2, topK);
    const collectionName = corpusCollectionName(input.corpusUserId);
    const empty: CorpusHybridSearchResult = {
        hits: [],
        recallSource: "empty",
        vectorRawCount: 0,
        sparseRawCount: 0,
    };
    if (!(await collectionExists(collectionName))) return empty;

    // ── ① 把问句做成两路查询向量 ───────────────────────────────────────────
    // sparse：本地分词 + 哈希成 (indices, values=TF)，不打 Ollama。
    // dense：打 Ollama embed；挂了就 denseOk=false，后面改走单路 sparse。
    const sparse = textToSparseVector(input.sparseQuery);
    const sparseOk = sparse.indices.length > 0;
    let dense: number[] | null = null;
    let denseOk = false;
    const vectorQuery = input.vectorQuery.trim();
    if (vectorQuery) {
        try {
            dense = await createOllamaEmbeddings().embedQuery(vectorQuery);
            denseOk = dense.length > 0;
        } catch {
            denseOk = false;
        }
    }

    if (!denseOk && !sparseOk) return empty;

    const client = getQdrantClient();
    const channel: CorpusHybridHit["recallChannel"] =
        denseOk && sparseOk ? "hybrid" : denseOk ? "vector" : "sparse";

    // ── ② 两路都通：prefetch + 引擎 RRF（一次 HTTP，不是本地 fuse）──────────
    // prefetch = 各路先各自捞一池候选人（比最终 topK 宽，默认 ×2）。
    // query.rrf = Qdrant 按「名次」融合，不直接比 cosine 分和 BM25 分（量纲不同）。
    // 公式直觉：1/(k+rank)；k 越大越平滑。weights 里 sparse 更大 = 字面命中更吃香。
    // 镜像 <1.15 或不认 weighted rrf 时，退回无权重 fusion:"rrf"。
    const queryHybrid = async () => {
        const prefetch = [
            {
                query: dense!,
                using: DENSE_VECTOR_NAME,
                limit: prefetchK,
            },
            {
                query: sparse,
                using: SPARSE_VECTOR_NAME,
                limit: prefetchK,
            },
        ];
        const weighted = {
            prefetch,
            query: {
                rrf: {
                    k: input.rrfK ?? 60,
                    weights: input.rrfWeights ?? [1, 1],
                },
            },
            limit: topK,
            with_payload: true as const,
        };
        try {
            return await client.query(collectionName, weighted);
        } catch {
            return client.query(collectionName, {
                prefetch,
                query: { fusion: "rrf" },
                limit: topK,
                with_payload: true,
            });
        }
    };

    // ── ③ 发查询：双通走 ②；只通一路就普通 query，不再融 ─────────────────
    const res =
        denseOk && sparseOk
            ? await queryHybrid()
            : denseOk
              ? await client.query(collectionName, {
                    query: dense!,
                    using: DENSE_VECTOR_NAME,
                    limit: topK,
                    with_payload: true,
                })
              : await client.query(collectionName, {
                    query: sparse,
                    using: SPARSE_VECTOR_NAME,
                    limit: topK,
                    with_payload: true,
                });

    // ── ④ 拆 payload、丢掉 README / _template ─────────────────────────────
    const hits: CorpusHybridHit[] = (res.points ?? [])
        .map((p) => ({
            ...payloadToHit(p.score ?? 0, p.payload as Record<string, unknown>),
            recallChannel: channel,
        }))
        .filter((h) => h.path && !isCorpusNoisePath(h.path));

    // RRF 原始分是「名次和」，绝对值不好读；hybrid 时除以本批 max，压到 0～1。
    // 单路不归一：那边已经是 cosine / sparse 相关度。
    if (channel === "hybrid" && hits.length > 0) {
        const max = Math.max(...hits.map((h) => h.score));
        if (max > 0) {
            for (const h of hits) {
                h.score = h.score / max;
            }
        }
    }

    const recallSource =
        hits.length === 0
            ? "empty"
            : channel === "hybrid"
              ? "hybrid"
              : channel;

    return {
        hits,
        recallSource,
        vectorRawCount: denseOk ? hits.length : 0,
        sparseRawCount: sparseOk ? hits.length : 0,
    };
};

export const indexCorpusDocuments = async (
    corpusUserId: string,
    docs: Document[],
    logger: Logger,
    options: EmbedIndexOptions = getEmbedIndexOptions()
): Promise<CorpusVectorIndexResult> => {
    const collectionName = corpusCollectionName(corpusUserId);
    const qdrantUrl = getQdrantUrl();
    const { ollama } = getBrainServiceConfig();
    const keep = docs.filter((d) => !isCorpusNoisePath(String(d.metadata.path ?? "")));
    logger.info({
        step: "4a",
        corpusUserId,
        collectionName,
        qdrantUrl,
        embedModel: ollama.models.embed,
        ollamaBaseUrl: ollama.baseUrl,
        chunkCount: docs.length,
        indexedChunkCount: keep.length,
        skippedNoise: docs.length - keep.length,
    }, "corpus index: config");
    const tDel = Date.now();
    await deleteCorpusCollection(collectionName);
    logger.info({
        step: "4b",
        corpusUserId,
        collectionName,
        durationMs: Date.now() - tDel,
    }, "corpus index: deleted old collection (full rebuild)");
    if (keep.length === 0) {
        return { collectionName, chunkCount: 0 };
    }
    await ensureCorpusCollection(collectionName, CORPUS_DENSE_VECTOR_SIZE);
    const embeddings = createOllamaEmbeddings();
    await mapEmbedBatches(
        keep,
        logger,
        (batch) => upsertCorpusDocumentBatch(collectionName, corpusUserId, batch, embeddings),
        options
    );
    logger.info({
        step: "4d",
        corpusUserId,
        collectionName,
        chunkCount: keep.length,
    }, "corpus index: all chunks embedded and stored");
    return { collectionName, chunkCount: keep.length };
};
