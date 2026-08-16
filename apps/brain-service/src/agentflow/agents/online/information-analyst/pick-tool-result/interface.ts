import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import type { QueryProfile } from "@/agentflow/agents/online/knowledge-manager";

/** 从 toolResults 对子问时用到的字段（避免与 analyze-helpers 循环依赖） */
export type PickToolResultInput = {
  userQuestion: string;
  slotId?: string;
  facetKey?: string;
  identityField?: IntakeIdentityField | null;
  queryType?: QueryProfile | null;
};
