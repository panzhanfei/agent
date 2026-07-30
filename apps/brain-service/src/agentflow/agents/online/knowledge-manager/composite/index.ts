/**
 * KM composite：多槽检索结果 merge / order（缓存见 @/agentflow/cache）。
 */
export type {
    CompositeRetrievePlan,
    CompositeSubRetrieval,
    RecalledUserFact,
} from "./interface";
export { mergeCompositeHits, mergeCompositeRetrieval } from "./merge";
export { orderSubResultsBySlots } from "./order-sub-results";
