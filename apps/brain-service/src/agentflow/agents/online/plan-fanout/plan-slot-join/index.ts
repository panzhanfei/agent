/**
 * planSlotJoin：等全部槽工人（km/list/mem/tool/summarize + userFactSide）汇合；
 * 按 compositeSlots 顺序混排 subResults → fanOutSlotPatch；
 * tool/summarize 的 toolResult 并入 toolResults（post 再跑 hits 后加工）。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import {
  mergeCompositeRetrieval,
  orderSubResultsBySlots,
} from "@/agentflow/agents/online/knowledge-manager";
import type { PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PlanSlotsPatch } from "../interface";

export const runPlanSlotJoinNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  const patches = state.fanOutSlotPatches ?? [];

  if (!decision) {
    return {
      fanOutSlotPatch: {
        error: "缺少入口路由决策",
        hits: [],
        coverage: "none",
      },
    };
  }

  if (patches.length > 0 && patches.every((p) => Boolean(p.error))) {
    const err = patches.find((p) => p.error)?.error ?? "槽位检索失败";
    return {
      fanOutSlotPatch: { error: err, hits: [], coverage: "none" },
    };
  }

  if (patches.length === 0) {
    return { fanOutSlotPatch: null };
  }

  const slots = decision.compositeSlots ?? [];
  const subResults = orderSubResultsBySlots(
    slots,
    patches.map((p) => p.sub)
  );
  const merged = mergeCompositeRetrieval(subResults);
  const stepResults = slots
    .map((slot) =>
      patches.find((p) => String(p.slotId) === String(slot.id))?.stepResult
    )
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const toolResults: PipelineToolResults = {};
  for (const p of patches) {
    if (p.toolResult) {
      toolResults[`slot_${p.slotId}`] = p.toolResult;
    }
  }

  const enumerationMeta =
    subResults.find((s) => s.enumerationMeta)?.enumerationMeta ?? null;
  const cacheHits = subResults.filter((s) => s.cacheHit).length;
  const facetHits = subResults.filter((s) => s.facetAnswerCacheHit).length;

  const incremental = state.compositeIncrementalPlan ?? null;

  const patch: PlanSlotsPatch = {
    hits: merged.hits,
    coverage: merged.coverage,
    notes: merged.notes,
    confidenceTier: merged.confidenceTier,
    enumerationMeta,
    compositeSubResults: subResults,
    compositeIncrementalPlan: incremental,
    compositeFacetCacheHits: facetHits,
    retrievalCacheSlotHits: cacheHits,
    retrievalCacheHit:
      subResults.length > 0 && cacheHits === subResults.length,
    checkerPassed: true,
    retryCount: state.retryCount,
    error: null,
    slotStepResults: stepResults,
    toolResults: Object.keys(toolResults).length > 0 ? toolResults : null,
  };

  logAgentOut("PlanSlotJoin", "完成", {
    slotCount: patches.length,
    kmCount: patches.filter((p) => p.executor === "km").length,
    listCount: patches.filter((p) => p.executor === "list").length,
    memCount: patches.filter((p) => p.executor === "mem").length,
    toolCount: patches.filter((p) => p.executor === "tool").length,
    summarizeCount: patches.filter((p) => p.executor === "summarize").length,
    hitCount: patch.hits?.length ?? 0,
    stepCount: stepResults.length,
    toolKeys: Object.keys(toolResults),
  });

  return {
    fanOutSlotPatch: patch,
    fanOutSlotPatches: [],
  };
};
