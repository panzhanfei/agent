export type {
  AgeExtraction,
  BirthDate,
  IdentityFieldExtraction,
  TenureExtraction,
  TenureRange,
  TenureScope,
} from "./interface";

export {
  buildAgeAnswer,
  computeAgeYears,
  extractBirthOrAgeFromHits,
  extractBirthOrAgeFromText,
  formatBirthLabel,
  isAgeSubQuestion,
} from "./compute-age";

export {
  buildTenureAnswer,
  computeTenureYearsMonths,
  extractTenureEntityHints,
  extractTenureFromHits,
  parseTenureRangesFromText,
  selectTenureRanges,
  tenureEndDate,
} from "./compute-tenure";

export {
  buildIdentityFieldAnswer,
  extractIdentityFieldFromHits,
  extractIdentityFieldFromText,
} from "./extract-identity-field";

export { computeAgeFromHitsTool } from "./compute-age-from-hits";
export { getCurrentDateTool } from "./get-current-date";
export { runComputeAgeFromHits } from "./run-age";
export { runComputeTenureFromHits } from "./run-tenure";
export { runExtractIdentityFromHits } from "./run-extract";
