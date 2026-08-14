import type { Document } from "@langchain/core/documents";
import pLimit from "p-limit";
import type { Logger } from "pino";
import type { EmbedIndexOptions } from "./interface";

export type { EmbedIndexOptions };

const clampInt = (raw: string | undefined, fallback: number, max: number): number => {
    if (raw === undefined || raw.trim() === "")
        return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(1, Math.round(n)));
};

export const getEmbedIndexOptions = (): EmbedIndexOptions => {
    return {
        concurrency: clampInt(process.env.INDEX_EMBED_CONCURRENCY, 3, 16),
        batchSize: clampInt(process.env.INDEX_EMBED_BATCH_SIZE, 8, 64),
    };
};

const chunkDocuments = <T>(items: T[], size: number): T[][] => {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        batches.push(items.slice(i, i + size));
    }
    return batches;
};

/** 分批并发跑 embed/upsert；fn 内自己 embed + 写库。 */
export const mapEmbedBatches = async (
    docs: Document[],
    logger: Logger,
    fn: (batch: Document[], batchIndex: number) => Promise<void>,
    options: EmbedIndexOptions = getEmbedIndexOptions()
): Promise<void> => {
    if (docs.length === 0)
        return;
    const { concurrency, batchSize } = options;
    const batches = chunkDocuments(docs, batchSize);
    const limit = pLimit(concurrency);
    logger.info({ chunkCount: docs.length, batchCount: batches.length, concurrency, batchSize }, "embed batches scheduled");
    let indexed = 0;
    await Promise.all(batches.map((batch, batchIndex) => limit(async () => {
        const tBatch = Date.now();
        const batchIds = batch.map((doc) => doc.id ?? "");
        const batchPaths = batch.map((doc) => String(doc.metadata.path ?? ""));
        logger.info({
            step: "4c-embed-start",
            batchIndex: batchIndex + 1,
            batchCount: batches.length,
            batchSize: batch.length,
            docIds: batchIds,
            paths: batchPaths,
        }, "embed batch started");
        await fn(batch, batchIndex);
        indexed += batch.length;
        logger.info({
            step: "4c-embed-done",
            batchIndex: batchIndex + 1,
            batchCount: batches.length,
            batchSize: batch.length,
            indexed,
            total: docs.length,
            durationMs: Date.now() - tBatch,
        }, "embed batch done");
    })));
};
