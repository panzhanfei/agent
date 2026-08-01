import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";

export type BirthDate = {
  year: number;
  month?: number;
  day?: number;
};

export type AgeExtraction = {
  birth?: BirthDate;
  explicitAge?: number;
  sourceHit?: KnowledgeHit;
  /** 展示用出生描述，如「1993 年 3 月」 */
  birthLabel?: string;
};

export type TenureRange = {
  startYear: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  ongoing: boolean;
};

export type TenureExtraction = {
  earliest: TenureRange;
  ranges: TenureRange[];
  sourceHit?: KnowledgeHit;
};

export type IdentityFieldExtraction = {
  value: string;
  sourceHit?: KnowledgeHit;
};
