/**
 * 兼容再导出。清单与 identity 字典在 `@/agentflow/tools/catalog`。
 */
export type { IdentityFieldSpec } from "./interface";
export {
  IDENTITY_FIELD_BY_ID,
  resolveIdentityField,
  resolveIdentityFieldFromPlan,
} from "@/agentflow/tools/catalog";
