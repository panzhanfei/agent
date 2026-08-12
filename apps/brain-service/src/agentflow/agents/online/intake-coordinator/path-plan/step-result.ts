/**
 * CompositeSub → StepResult（工人出站形状）。
 */
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager/composite/interface";
import type { StepResult } from "./interface";

export const subToStepResult = (
  sub: CompositeSubRetrieval,
  pathKind: StepResult["pathKind"] = "km"
): StepResult => ({
  stepId: String(sub.slot),
  pathKind:
    sub.enumerationMeta || String(sub.facetKey ?? "").startsWith("list:")
      ? "list"
      : pathKind,
  label: sub.label,
  hits: sub.hits,
  coverage: sub.coverage,
  notes: sub.notes,
  confidenceTier: sub.confidenceTier ?? null,
  enumerationMeta: sub.enumerationMeta ?? null,
  cacheHit: sub.cacheHit,
  facetKey: sub.facetKey,
});
