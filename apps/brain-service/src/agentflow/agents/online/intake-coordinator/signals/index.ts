export {
  countNumberedLines,
  decisionRequestsExternalLink,
  dedupePlanLabels,
  extractNumberedPlanUnits,
  hasExplicitMultipartStructure,
  hasStaleMultipartFromDecision,
  historyContainsUrl,
  historySupportsContinuation,
  isShortContinuationUtterance,
  lastSubstantiveUserQuestion,
  stripEnumerationPrefix,
} from "./query-signals";
export { isPureSocialUtterance } from "./pure-social-utterance";
export type { CoreferenceMergeRetry } from "./interface";
export {
  buildMergedCoreferenceQuestion,
  isAckLikeSingleChar,
  isSingleCodePointUtterance,
  normalizeIntakeUtterance,
  rewriteLastUserTurn,
  shouldRetryCoreferenceMerge,
  shouldShortCircuitIncompleteUtterance,
  substantiveUtteranceForSingleChar,
  surfaceForSingleCharSignal,
  utteranceCodePointLength,
} from "./effective-intake-question";
