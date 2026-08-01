/**
 * km 单槽工人：executeKmSlotSub → 出 hits（无工人内 FC / 无 refinedSearchQuery 重试）。
 * 改 query / 再检只走 Join 后全局 B（阶段 4）。
 */
import { subToStepResult } from "@/agentflow/agents/online/fact-checker";
import type { StepFactCheck, StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { CompositeSubRetrieval } from "../composite/interface";
import { executeKmSlotSub } from "./execute-sub";

/** 主路径跳过 FC；保留 StepResult.fc 形状供下游兼容 */
const KM_FC_SKIPPED: StepFactCheck = {
  passed: true,
  refinedSearchQuery: null,
  issues: [],
  checkerNotes: "km_skip_worker_fc_phase4",
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
  pathKind: "km",
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

/** km 单槽工人：仅 retrieve（阶段 4：无 FC 环） */
export const runKmSlotWorker = async (
  state: PipelineGraphState
): Promise<PlanSlotWorkerPatch> => {
  const slot = resolveActiveSlot(state);
  const slotId = state.activeSlotId ?? "unknown";
  if (!slot) {
    return {
      slotId,
      executor: "km",
      sub: emptySub(slotId, "unknown", "缺少 activeSlotId"),
      stepResult: failedStep(slotId, "unknown", "缺少 activeSlotId"),
      error: "缺少 activeSlotId",
    };
  }

  try {
    const sub = await executeKmSlotSub({
      corpusUserId: state.context.corpusUserId,
      plan: state.compositeIncrementalPlan,
      slot,
    });
    const step = subToStepResult(sub, KM_FC_SKIPPED, "km");
    return {
      slotId: String(slot.id),
      executor: "km",
      sub,
      stepResult: step,
      error: null,
      retried: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "km 单槽检索失败";
    const sub = emptySub(String(slot.id), slot.label, msg);
    return {
      slotId: String(slot.id),
      executor: "km",
      sub,
      stepResult: failedStep(String(slot.id), slot.label, msg),
      error: msg,
    };
  }
};
