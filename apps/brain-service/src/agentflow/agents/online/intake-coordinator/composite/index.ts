/** Intake composite（规划侧）聚合导出 */
export type {
  CompositeFacetId,
  CompositeRetrievalSlot,
  CompositeRoutePlanSource,
  CompositeSlotId,
  EnumerationTarget,
  EnumerationTargetInput,
  IdentityFieldSearchSpec,
} from "./interface";

export {
    looksLikeMultiPartQuestion,
    normalizePlanItems,
    resolveEffectiveQueryType,
    splitQuestionUnits,
} from "./composite-routing";
export {
    EMPLOYERS_SLOT,
    EXTERNAL_LINK_SLOT,
    IDENTITY_SLOT,
    PROJECTS_SLOT,
    canonicalizePlanItem,
    facetTemplateForQueryType,
    planItemToSlot,
} from "./composite-slot-queries";
export { IDENTITY_FIELD_SEARCH } from "./identity-field-search";
export {
    dedupePlanByFacet,
    normalizePlanItemFromSchema,
    planFacetKey,
} from "./repair-retrieval-plan";
export {
    isProjectEnumeration,
    resolveEnumerationTarget,
} from "./enumeration-target";
