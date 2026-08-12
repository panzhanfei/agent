/**
 * planSlotJoin：等本波槽工人（+ planDag）汇合；
 * 首遍后可跑全局 B（≤1）→ pending 再批；再批波合并进 fanOutSlotPatch。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import {
  mergeCompositeRetrieval,
  orderSubResultsBySlots,
} from "@/agentflow/agents/online/knowledge-manager";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import type { PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/interface";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import {
  createPendingSlot,
  isDeadlineExceeded,
  isGlobalRebatchEnabledFromEnv,
  isTerminalSlotStatus,
  markSlotSkipped,
  type SlotRuntimeState,
} from "@/agentflow/execution";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PlanSlotWorkerPatch, PlanSlotsPatch } from "../interface";
import { runGlobalRebatchPlanning } from "../global-rebatch";

const buildPatchFromWorkerPatches = (
  state: PipelineGraphState,
  patches: readonly PlanSlotWorkerPatch[],
  slotRuntimeById: Record<string, SlotRuntimeState>
): PlanSlotsPatch => {
  const decision = state.decision!;
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
    .filter((s): s is StepResult => Boolean(s));

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

  return {
    hits: merged.hits,
    coverage: merged.coverage,
    notes: merged.notes,
    confidenceTier: merged.confidenceTier,
    enumerationMeta,
    compositeSubResults: subResults,
    compositeIncrementalPlan: state.compositeIncrementalPlan ?? null,
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
};

/** 再批补丁按 slotId 覆盖进首遍汇合结果 */
const mergeRebatchPatch = (
  state: PipelineGraphState,
  prior: PlanSlotsPatch,
  rebatchPatches: readonly PlanSlotWorkerPatch[]
): PlanSlotsPatch => {
  const decision = state.decision!;
  const slots = decision.compositeSlots ?? [];
  const subById = new Map<string, CompositeSubRetrieval>(
    (prior.compositeSubResults ?? []).map((s) => [String(s.slot), s])
  );
  const stepById = new Map<string, StepResult>(
    (prior.slotStepResults ?? []).map((s) => [String(s.stepId), s])
  );
  const toolResults: PipelineToolResults = { ...(prior.toolResults ?? {}) };

  for (const p of rebatchPatches) {
    const id = String(p.slotId);
    subById.set(id, p.sub);
    stepById.set(id, p.stepResult);
    if (p.toolResult) {
      toolResults[`slot_${id}`] = p.toolResult;
    } else {
      delete toolResults[`slot_${id}`];
    }
  }

  const orderedSubs = orderSubResultsBySlots(slots, [...subById.values()]);
  const merged = mergeCompositeRetrieval(orderedSubs);
  const stepResults = slots
    .map((slot) => stepById.get(String(slot.id)))
    .filter((s): s is StepResult => Boolean(s));
  const cacheHits = orderedSubs.filter((s) => s.cacheHit).length;
  const facetHits = orderedSubs.filter((s) => s.facetAnswerCacheHit).length;

  return {
    ...prior,
    hits: merged.hits,
    coverage: merged.coverage,
    notes: merged.notes,
    confidenceTier: merged.confidenceTier,
    enumerationMeta:
      orderedSubs.find((s) => s.enumerationMeta)?.enumerationMeta ??
      prior.enumerationMeta ??
      null,
    compositeSubResults: orderedSubs,
    compositeFacetCacheHits: facetHits,
    retrievalCacheSlotHits: cacheHits,
    retrievalCacheHit:
      orderedSubs.length > 0 && cacheHits === orderedSubs.length,
    slotStepResults: stepResults,
    toolResults: Object.keys(toolResults).length > 0 ? toolResults : null,
    error: null,
  };
};

const syncSlotRuntimes = (
  state: PipelineGraphState,
  patches: readonly PlanSlotWorkerPatch[]
): Record<string, SlotRuntimeState> => {
  const slots = state.decision?.compositeSlots ?? [];
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
        // 再批波只带部分槽：未出现在本波的槽保持原终态
        const wasRebatch =
          (state.pendingGlobalRebatchSlotIds?.length ?? 0) > 0 ||
          state.pendingGlobalRebatchDag;
        if (!wasRebatch) {
          runtime = markSlotSkipped(runtime, "error", now);
        }
      }
    }
    slotRuntimeById[id] = runtime;
  }
  return slotRuntimeById;
};

export const runPlanSlotJoinNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  const patches = state.fanOutSlotPatches ?? [];
  const wasRebatchPending =
    (state.pendingGlobalRebatchSlotIds?.length ?? 0) > 0 ||
    Boolean(state.pendingGlobalRebatchDag);

  if (!decision) {
    return {
      fanOutSlotPatch: {
        error: "缺少入口路由决策",
        hits: [],
        coverage: "none",
      },
      pendingGlobalRebatchSlotIds: [],
      pendingGlobalRebatchDag: false,
      pendingGlobalRebatchDagNodeIds: [],
    };
  }

  const slotRuntimeById = syncSlotRuntimes(state, patches);

  // 再批汇合：覆盖进首遍 fanOutSlotPatch，不再跑 B
  if (wasRebatchPending) {
    const prior = state.fanOutSlotPatch;
    let patch: PlanSlotsPatch | null = prior;
    if (patches.length > 0) {
      if (prior) {
        patch = mergeRebatchPatch(state, prior, patches);
      } else {
        patch = buildPatchFromWorkerPatches(state, patches, slotRuntimeById);
      }
    }
    if (patches.length > 0 && patches.every((p) => Boolean(p.error)) && !prior) {
      const err = patches.find((p) => p.error)?.error ?? "槽位检索失败";
      patch = { error: err, hits: [], coverage: "none" };
    }

    logAgentOut("PlanSlotJoin", "再批汇合", {
      rebatchPatchCount: patches.length,
      pendingCleared: true,
    });

    return {
      fanOutSlotPatch: patch,
      fanOutSlotPatches: [],
      slotRuntimeById,
      pendingGlobalRebatchSlotIds: [],
      pendingGlobalRebatchDag: false,
      pendingGlobalRebatchDagNodeIds: [],
    };
  }

  if (patches.length > 0 && patches.every((p) => Boolean(p.error))) {
    const err = patches.find((p) => p.error)?.error ?? "槽位检索失败";
    return {
      fanOutSlotPatch: { error: err, hits: [], coverage: "none" },
      fanOutSlotPatches: [],
      slotRuntimeById,
      pendingGlobalRebatchSlotIds: [],
      pendingGlobalRebatchDag: false,
      pendingGlobalRebatchDagNodeIds: [],
    };
  }

  if (patches.length === 0 && !state.fanOutDagPatch) {
    return {
      fanOutSlotPatch: null,
      pendingGlobalRebatchSlotIds: [],
      pendingGlobalRebatchDag: false,
      pendingGlobalRebatchDagNodeIds: [],
    };
  }

  const patch =
    patches.length > 0
      ? buildPatchFromWorkerPatches(state, patches, slotRuntimeById)
      : null;

  const runtimeList = (decision.compositeSlots ?? []).map(
    (s) => slotRuntimeById[String(s.id)] ?? createPendingSlot(String(s.id))
  );

  let nextDecision = decision;
  let pendingSlotIds: string[] = [];
  let pendingDag = false;
  let pendingDagNodeIds: string[] = [];
  let globalRebatchUsed = state.globalRebatchUsed;

  const globalRebatchEnabled = isGlobalRebatchEnabledFromEnv();
  const mayPlanGlobalB =
    globalRebatchEnabled &&
    !globalRebatchUsed &&
    (patches.length > 0 || Boolean(state.fanOutDagPatch));
  if (mayPlanGlobalB) {
    const dagTools = {
      ...(state.fanOutDagPatch?.toolResults ?? {}),
    };
    const planned = await runGlobalRebatchPlanning({
      decision,
      userQuestion: state.userQuestion,
      patches,
      slotRuntimeById,
      policy: state.retryPolicy,
      dagToolResults: Object.keys(dagTools).length > 0 ? dagTools : null,
    });
    if (planned) {
      nextDecision = planned.decision;
      pendingSlotIds = planned.rebatchSlotIds;
      pendingDag = planned.rebatchDag;
      pendingDagNodeIds = planned.rebatchDagNodeIds;
      globalRebatchUsed = true;
      // 再批前把目标槽打回 pending（保留 attempts）
      for (const id of pendingSlotIds) {
        const prev = slotRuntimeById[id] ?? createPendingSlot(id);
        slotRuntimeById[id] = {
          ...prev,
          status: "pending",
          reason: null,
          finishedAtMs: null,
        };
      }
    }
  }

  logAgentOut("PlanSlotJoin", "完成", {
    slotCount: patches.length,
    kmCount: patches.filter((p) => p.executor === "km").length,
    listCount: patches.filter((p) => p.executor === "list").length,
    memCount: patches.filter((p) => p.executor === "mem").length,
    toolCount: patches.filter((p) => p.executor === "tool").length,
    summarizeCount: patches.filter((p) => p.executor === "summarize").length,
    hitCount: patch?.hits?.length ?? 0,
    stepCount: patch?.slotStepResults?.length ?? 0,
    toolKeys: Object.keys(patch?.toolResults ?? {}),
    slotStatuses: runtimeList.map((r) => ({
      slotId: r.slotId,
      status: r.status,
      reason: r.reason ?? null,
      attempts: r.attempts,
      degraded: Boolean(r.degraded),
    })),
    globalRebatchEnabled,
    globalRebatchUsed,
    pendingGlobalRebatchSlotIds: pendingSlotIds,
    pendingGlobalRebatchDag: pendingDag,
    pendingGlobalRebatchDagNodeIds: pendingDagNodeIds,
    hasDagPatch: Boolean(state.fanOutDagPatch),
  });

  return {
    decision: nextDecision,
    fanOutSlotPatch: patch,
    fanOutSlotPatches: [],
    slotRuntimeById,
    pendingGlobalRebatchSlotIds: pendingSlotIds,
    pendingGlobalRebatchDag: pendingDag,
    pendingGlobalRebatchDagNodeIds: pendingDagNodeIds,
    globalRebatchUsed,
  };
};
