import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import type { QueryProfile } from "../profile/interface";

export type { QueryProfile };

/** HY-05：召回通道 */
export type RecallChannel = "vector" | "sparse" | "hybrid";

/** HY-04：Hybrid 主路径 recallSource */
export type RecallSource =
  | "provided"
  | "hybrid"
  | "vector"
  | "sparse"
  | "empty";

/** EV-04：检索置信分档 */
export type ConfidenceTier = "high" | "mid" | "low";

/** 列举型检索元数据（项目/公司穷举 UI） */
export type EnumerationMeta = {
  listKind: "project" | "experience";
  totalExpected: number;
  shown: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
};

/** HY-05：统一候选（Qdrant Cosine / 引擎 RRF / sparse rawScore + 可选 fusionScore） */
export type KnowledgeCandidate = {
  path: string;
  title: string;
  body: string;
  /** Qdrant Cosine 或 RRF（越大越好） */
  score?: number;
  rawScore?: number;
  recallChannel?: RecallChannel;
  fusionScore?: number;
};

/**
 * KnowledgeManager 输入/输出类型（检索合同）。
 * 在线检索不调 LLM，见 retrieve.ts。
 */
export type KnowledgeHit = {
  /** 相对仓库的路径，如 data/doc/users/<userId>/corpus/personal/个人简历.md */
  path: string;
  title: string;
  /** 与查询相关的原文摘录，须来自 candidate 正文，勿编造 */
  excerpt: string;
  /** 0–1，与 searchQuery 的相关度 */
  relevance: number;
};

export type KnowledgeRetrievalResult = {
  hits: KnowledgeHit[];
  coverage: "sufficient" | "partial" | "none";
  notes: string | null;
  /** EV-04：可选置信分档（向后兼容） */
  confidenceTier?: ConfidenceTier;
  /** EV-01：0–1 综合置信分（日志 / eval 用） */
  confidenceScore?: number;
  /** 列举型：语料总数 vs 本次 hits 数 */
  enumerationMeta?: EnumerationMeta;
};

export type KnowledgeManagerInput = {
  corpusUserId: string;
  searchQuery: string;
  topics: string[];
  subTasks: string[];
  /** Intake queryType；缺失时 KM 规则推断（KM-08） */
  queryType?: QueryProfile | null;
  /** Intake identityField；仅 queryType=identity 时参与 docKind 过滤 */
  identityField?: IntakeIdentityField | null;
  /** Intake enumerationControl.listKind；仅 queryType=enumeration 时收窄类型 */
  listKind?: "project" | "experience" | null;
  candidates: KnowledgeCandidate[];
};
