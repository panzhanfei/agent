/**
 * planSlotJoin：等全部槽工人汇合；
 * 按 compositeSlots 顺序混排 subResults → fanOutSlotPatch；
 * 汇合 slotRuntimeById；超时/缺失兜底 skipped；全局 B 仅打日志（阶段 4 再批）。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import {
  mergeCompositeRetrieval,
  orderSubResultsBySlots,
} from "@/agentflow/agents/online/knowledge-manager";
import type { PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/interface";
import {
  createPendingSlot,
  isDeadlineExceeded,
  isGlobalRebatchEnabledFromEnv,
  isTerminalSlotStatus,
  markSlotSkipped,
  shouldTriggerGlobalRebatch,
  type SlotRuntimeState,
} from "@/agentflow/execution";
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

  const now = Date.now();
  const slotRuntimeById: Record<string, SlotRuntimeState> = {
    ...(state.slotRuntimeById ?? {}),
  };
  for (const p of patches) {
    if (p.slotRuntime) {
      slotRuntimeById[String(p.slotId)] = p.slotRuntime;
    }
  }

  for (const slot of slots) {
    const id = String(slot.id);
    let runtime = slotRuntimeById[id] ?? createPendingSlot(id);
    if (!isTerminalSlotStatus(runtime.status)) {
      const hasPatch = patches.some((p) => String(p.slotId) === id);
      if (isDeadlineExceeded(runtime, state.retryPolicy, now)) {
        runtime = markSlotSkipped(runtime, "timeout", now);
      } else if (!hasPatch) {
        runtime = markSlotSkipped(runtime, "error", now);
      }
    }
    slotRuntimeById[id] = runtime;
  }

  const runtimeList = slots.map(
    (s) => slotRuntimeById[String(s.id)] ?? createPendingSlot(String(s.id))
  );
  const globalRebatchEnabled = isGlobalRebatchEnabledFromEnv();
  const globalRebatchCandidate =
    globalRebatchEnabled && shouldTriggerGlobalRebatch(runtimeList);

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
    slotStatuses: runtimeList.map((r) => ({
      slotId: r.slotId,
      status: r.status,
      reason: r.reason ?? null,
      attempts: r.attempts,
      degraded: Boolean(r.degraded),
    })),
    globalRebatchCandidate,
    globalRebatchEnabled,
  });

  if (globalRebatchCandidate) {
    logAgentOut("PlanSlotJoin", "全局B候选", {
      note: "阶段1仅观测；阶段4再批 L1",
      slotCount: runtimeList.length,
      skippedOrDegraded: runtimeList.filter(
        (r) => r.status === "skipped" || r.degraded
      ).length,
    });
  }

  return {
    fanOutSlotPatch: patch,
    fanOutSlotPatches: [],
    slotRuntimeById,
  };
};
