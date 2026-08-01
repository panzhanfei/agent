export type {
  AgeExtraction,
  BirthDate,
  IdentityFieldExtraction,
  TenureExtraction,
  TenureRange,
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
  extractTenureFromHits,
  parseTenureRangesFromText,
} from "./compute-tenure";

export {
  buildIdentityFieldAnswer,
  extractIdentityFieldFromHits,
  extractIdentityFieldFromText,
} from "./extract-identity-field";

export { computeAgeFromHitsTool } from "./compute-age-from-hits";
export { getCurrentDateTool } from "./get-current-date";
