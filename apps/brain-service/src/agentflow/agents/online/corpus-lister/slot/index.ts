/**
 * list 单槽工人：fetchListSlot（不经 FactChecker）。
 * list_corpus 为目录扫盘，与纯 listRetriever 一致；FC 仅用于 km 等非确定性检索。
 */
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import { subToStepResult } from "@/agentflow/agents/online/fact-checker";
import type { StepFactCheck, StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import { fetchListSlot } from "../fetch-list-slot";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

const LIST_FC_SKIPPED: StepFactCheck = {
  passed: true,
  refinedSearchQuery: null,
  issues: [],
  checkerNotes: "list_corpus_skip_fc",
};

const emptySub = (
  slotId: string,
  label: string,
  notes: string | null
): CompositeSubRetrieval => ({
  slot: slotId,
  label,
  hits: [],
  coverage: "none",
  notes,
  cacheHit: false,
  facetAnswerCacheHit: false,
});

const failedStep = (
  slotId: string,
  label: string,
  notes: string
): StepResult => ({
  stepId: slotId,
  pathKind: "list",
  label,
  hits: [],
  coverage: "none",
  notes,
  confidenceTier: null,
  enumerationMeta: null,
  cacheHit: false,
  fc: {
    passed: false,
    refinedSearchQuery: null,
    issues: [],
    checkerNotes: notes,
  },
});

const listSubToStepResult = (sub: CompositeSubRetrieval): StepResult =>
  subToStepResult(sub, LIST_FC_SKIPPED, "list");

/** list 单槽：fetchListSlot（跳过 FC） */
export const runListSlotWorker = async (
  state: PipelineGraphState
): Promise<PlanSlotWorkerPatch> => {
  const slot = resolveActiveSlot(state);
  const slotId = state.activeSlotId ?? "unknown";
  if (!slot) {
    return {
      slotId,
      executor: "list",
      sub: emptySub(slotId, "unknown", "缺少 activeSlotId"),
      stepResult: failedStep(slotId, "unknown", "缺少 activeSlotId"),
      error: "缺少 activeSlotId",
    };
  }

  try {
    const sub = await fetchListSlot(
      slot,
      state.context.corpusUserId,
      state.asOfDate ?? null
    );
    return {
      slotId: String(slot.id),
      executor: "list",
      sub,
      stepResult: listSubToStepResult(sub),
      error: null,
      retried: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "list 单槽检索失败";
    const sub = emptySub(String(slot.id), slot.label, msg);
    return {
      slotId: String(slot.id),
      executor: "list",
      sub,
      stepResult: failedStep(String(slot.id), slot.label, msg),
      error: msg,
    };
  }
};
