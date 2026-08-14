/**
 * Hybrid 召回：Qdrant dense + sparse prefetch，引擎内 RRF。
 */
import { isCorpusNoisePath, searchCorpusHybrid } from "@fambrain/corpus";
import {
    RRF_K,
    RRF_SPARSE_WEIGHT,
    RRF_VECTOR_WEIGHT,
    VECTOR_FETCH_MULTIPLIER,
} from "../profile/km-config";
import type { KnowledgeCandidate, RecallSource } from "../contract/interface";
import type { HybridRecallResult } from "./interface";

export type { HybridRecallResult };

export const hybridRecall = async (
    corpusUserId: string,
    vectorQuery: string,
    sparseQuery: string,
    vectorTopK: number
): Promise<HybridRecallResult> => {
    const prefetchK = Math.ceil(vectorTopK * VECTOR_FETCH_MULTIPLIER);
    const empty: HybridRecallResult = {
        candidates: [],
        recallSource: "empty",
        vectorRawCount: 0,
        sparseRawCount: 0,
        uniquePathCount: 0,
    };

    try {
        const result = await searchCorpusHybrid({
            corpusUserId,
            vectorQuery,
            sparseQuery,
            topK: vectorTopK,
            prefetchK,
            rrfK: RRF_K,
            rrfWeights: [RRF_VECTOR_WEIGHT, RRF_SPARSE_WEIGHT],
        });
        const candidates: KnowledgeCandidate[] = result.hits
            .filter((h) => !isCorpusNoisePath(h.path))
            .slice(0, vectorTopK)
            .map((h) => ({
                path: h.path,
                title: h.title,
                body: h.body,
                score: h.score,
                rawScore: h.score,
                fusionScore: h.score,
                recallChannel: h.recallChannel,
            }));
        const recallSource: RecallSource =
            candidates.length === 0 ? "empty" : result.recallSource;
        return {
            candidates,
            recallSource,
            vectorRawCount: result.vectorRawCount,
            sparseRawCount: result.sparseRawCount,
            uniquePathCount: new Set(candidates.map((c) => c.path)).size,
        };
    } catch {
        return empty;
    }
};
