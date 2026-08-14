import type { CorpusDocKind } from "./doc-kind";

export type { CorpusDocKind };

export type CorpusVectorHit = {
    path: string;
    title: string;
    body: string;
    score: number;
    docKind?: CorpusDocKind;
};

export type CorpusHybridHit = CorpusVectorHit & {
    recallChannel: "vector" | "sparse" | "hybrid";
};

export type CorpusHybridSearchResult = {
    hits: CorpusHybridHit[];
    recallSource: "hybrid" | "vector" | "sparse" | "empty";
    vectorRawCount: number;
    sparseRawCount: number;
};

export type CorpusVectorIndexResult = {
    collectionName: string;
    chunkCount: number;
};

export type EmbedIndexOptions = {
    concurrency: number;
    batchSize: number;
};

export type ChunkMetadata = {
    corpusUserId: string;
    path: string;
    title: string;
    chunkIndex: number;
    docKind?: CorpusDocKind;
};

export type RecallKeywordHit = {
    path: string;
    title: string;
    body: string;
    excerpt: string;
    score: number;
    recallChannel: "sparse";
};

export type Bm25Index = {
    score: (queryTokens: string[]) => number[];
};
