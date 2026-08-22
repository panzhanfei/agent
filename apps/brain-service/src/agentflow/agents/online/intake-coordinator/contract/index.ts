/** Intake contract 聚合导出 */
export type {
  IntakeCoreferenceStatus,
  IntakeIdentityField,
  IntakeRetrievalPlanItem,
  IntakeRoutingDecision,
} from "./interface";
export type { EnumerationControl } from "./interface";

export {
  ATTACHMENT_INTAKE_NOTE,
  COREFERENCE_MERGE_RETRY_NOTE,
  JSON_FORMAT_REPAIR_NOTE,
  prompt,
} from "./prompt";

export { defaultTranslateTargetLangFromReplyLanguage } from "./reply-language";

export {
  intakeRetrievalPlanItemSchema,
  intakeRoutingDecisionSchema,
  parseIntakeRoutingDecision,
} from "./schema";
