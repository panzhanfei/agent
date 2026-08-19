export type { ExtractedLink, ExternalLinkScope } from "./interface";
export { runExtractExternalLinksFromHits } from "./run";

export {
  buildExternalLinksAnswer,
  extractExternalLinkEntityTokens,
  extractExternalLinksFromHits,
  extractUrlsFromText,
  filterExternalLinksByScope,
  resolveExternalLinkScope,
  resolveLinkTitle,
  scopeRequestsMultipleLinks,
  scopeRequestsOnlineUrls,
  scopeRequestsRepoHostOnly,
} from "./extract-external-links";
