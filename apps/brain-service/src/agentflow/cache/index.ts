export type {
    CompositeCachePlan,
    CompositeSlotPlan,
    IncrementalCompositePlan,
    PreresolvedSlotHits,
} from "./interface";
export {
    buildFacetKey,
    attachFacetKey,
    facetAnswerMatchesSlot,
    isPaginatedListCorpusSlot,
    detectCompositeRefreshIntent,
} from "./facet-key";
export {
    cachedFacetToAnalystResult,
    analystResultToCachedFacet,
} from "./facet-bridge";
export { writeFacetSession, type WriteFacetSessionInput } from "./write-session";
export { lookupHitsCache, retrieveKmWithHitsCache } from "./slot-hits";
export {
    resolveCompositeCachePlan,
    resolveIncrementalCompositePlan,
    type ResolveCompositeCachePlanInput,
} from "./resolve-composite-plan";
export {
    subFromFacetCache,
    subFromHits,
    findSlotCachePlan,
} from "./sub-from-plan";

/** @deprecated 用 retrieveKmWithHitsCache */
export { retrieveKmWithHitsCache as retrieveSlotWithCache } from "./slot-hits";
