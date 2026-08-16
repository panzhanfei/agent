/**
 * 工具契约：identityField → toolId。不含 Intake 路由信号、语料表头。
 */
import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import type { IdentityFieldSpec } from "./interface";

export type { IdentityFieldSpec } from "./interface";

export const IDENTITY_FIELD_BY_ID: Record<IntakeIdentityField, IdentityFieldSpec> =
  {
    age: {
      id: "age",
      toolId: "compute_age_from_hits",
      requiresCompute: true,
    },
    birthYear: {
      id: "birthYear",
      toolId: "extract_identity_from_hits",
      requiresCompute: false,
    },
    name: {
      id: "name",
      toolId: "extract_identity_from_hits",
      requiresCompute: false,
    },
    education: {
      id: "education",
      toolId: null,
      requiresCompute: false,
    },
    career: {
      id: "career",
      toolId: null,
      requiresCompute: false,
    },
    tenure: {
      id: "tenure",
      toolId: "compute_tenure_from_hits",
      requiresCompute: true,
    },
    email: {
      id: "email",
      toolId: null,
      requiresCompute: false,
    },
    phone: {
      id: "phone",
      toolId: null,
      requiresCompute: false,
    },
  };

export const resolveIdentityFieldFromPlan = (input: {
  identityField?: IntakeIdentityField | null;
}): IdentityFieldSpec | null => {
  const id = input.identityField ?? null;
  if (!id) return null;
  return IDENTITY_FIELD_BY_ID[id] ?? null;
};

/**
 * @deprecated 改用 resolveIdentityFieldFromPlan({ identityField })。
 */
export const resolveIdentityField = (
  _label: string,
  identityField?: IntakeIdentityField | null
): IdentityFieldSpec | null =>
  resolveIdentityFieldFromPlan({ identityField });
