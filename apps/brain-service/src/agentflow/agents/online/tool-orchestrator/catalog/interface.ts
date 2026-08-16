import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import type { ToolRunId } from "../interface";

/** 声明式 identity 字段 → 工具映射（由 Intake identityField 索引） */
export type IdentityFieldSpec = {
  id: IntakeIdentityField;
  toolId: ToolRunId | null;
  requiresCompute: boolean;
};
