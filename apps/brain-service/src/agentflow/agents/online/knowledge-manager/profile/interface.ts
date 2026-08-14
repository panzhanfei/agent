/** KM queryProfile + 置信度类型（实现见同目录 *.ts） */

import type {
  ConfidenceTier,
  KnowledgeCandidate,
  KnowledgeHit,
  RecallSource,
} from "../contract/interface";
import type { RankedCandidate } from "../recall/interface";

export type QueryProfile =
  | "identity"
  | "enumeration"
  | "tech"
  | "external_link"
  | "relations"
  | "default";

export type ConfidenceInput = {
  queryProfile: QueryProfile;
  hits: KnowledgeHit[];
  ranked: RankedCandidate[];
  recallSource: RecallSource;
  topCandidate?: KnowledgeCandidate;
  candidateCount: number;
};

export type ConfidenceAssessment = {
  tier: ConfidenceTier;
  score: number;
  top1Relevance: number;
  top1Top2Gap: number;
  fusionSignal: number;
  pathAuthority: number;
  reasons: string[];
};
