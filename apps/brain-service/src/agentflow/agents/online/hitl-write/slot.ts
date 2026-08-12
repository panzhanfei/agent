/**
 * corpus_edit 单槽工人（已退役）：新编辑请走 vault_workspace。
 * 遗留「确认/放弃提案」UI 仍由 intake-bypass + apply 处理。
 */
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { corpusEditErrorMessage } from "./errors";

const emptySub = (
  slotId: string,
  label: string,
  notes: string | null
): CompositeSubRetrieval => ({
  slot: slotId,
  label,
  hits: [],
  coverage: notes ? "sufficient" : "none",
  notes,
  cacheHit: false,
  facetAnswerCacheHit: false,
  dataSource: "corpus",
});

const failedStep = (
  slotId: string,
  label: string,
  notes: string
): StepResult => ({
  stepId: slotId,
  pathKind: "corpus_edit",
  label,
  hits: [],
  coverage: "sufficient",
  notes,
  confidenceTier: null,
  enumerationMeta: null,
  cacheHit: false,
});

export const runCorpusEditSlotWorker = async (
  state: PipelineGraphState
): Promise<PlanSlotWorkerPatch> => {
  const slot = resolveActiveSlot(state);
  const slotId = state.activeSlotId ?? "unknown";
  const language = state.decision?.language === "en" ? "en" : "zh";
  const notes = corpusEditErrorMessage("corpus_md_hitl_retired", language);

  if (!slot) {
    return {
      slotId,
      executor: "corpus_edit",
      sub: emptySub(slotId, "unknown", notes),
      stepResult: failedStep(slotId, "unknown", notes),
      error: null,
    };
  }

  return {
    slotId: String(slot.id),
    executor: "corpus_edit",
    sub: emptySub(String(slot.id), slot.label, notes),
    stepResult: failedStep(String(slot.id), slot.label, notes),
    error: null,
  };
};
