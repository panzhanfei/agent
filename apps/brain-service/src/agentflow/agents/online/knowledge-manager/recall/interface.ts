import type { KnowledgeCandidate, RecallSource } from "../contract/interface";

/** 与 retrieve.ts CandidateRow / KnowledgeCandidate 对齐 */
export type VectorChunkRow = {
  path: string;
  title: string;
  body: string;
  score?: number;
  rawScore?: number;
  recallChannel?: "vector" | "sparse" | "hybrid";
  fusionScore?: number;
};

export type RankedCandidate = VectorChunkRow & {
  keywordRelevance: number;
  vectorRelevance: number;
  pathBoost: number;
  relevance: number;
  excerpt: string;
};

export type HybridRecallResult = {
  candidates: KnowledgeCandidate[];
  recallSource: RecallSource;
  vectorRawCount: number;
  sparseRawCount: number;
  uniquePathCount: number;
};

export type RrfRankedItem = {
  path: string;
  fusionScore: number;
};
