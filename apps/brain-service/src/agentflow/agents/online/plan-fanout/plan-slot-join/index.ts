/**
 * planSlotJoin：本波并行工人的汇合点（LangGraph 齐步后再进本节点一次）。
 *
 * 三条路都边接到这里，但写入/汇总不同：
 * - 槽路（km/list/mem/tool/summarize）：每人 append 一条 fanOutSlotPatches
 *   → 本节点按槽序合成 fanOutSlotPatch
 * - DAG 路：工人已写 fanOutDagPatch；这里只读（给全局 B），和槽的终拼在 planMerge
 * - userFact 路：工人已写 sideEffectAnswer；这里不汇总，只齐步（remember 落盘后再往下）
 *
 * 首遍汇合后可跑全局 B（≤1 次）：改 query / 外搜 / abandon → pending 再 Send。
 * 再批波回来仍进本节点：按 slotId 覆盖进首遍 fanOutSlotPatch，不再跑 B。
 *
 * 本节点不 Send、不改检索实现；再批 Send 在 routeAfterPlanSlotJoin。
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

/** 首遍：本波槽补丁按 compositeSlots 顺序合成一份 fanOutSlotPatch */
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

/**
 * 用工人带回的 slotRuntime 对账：超时 → skipped；
 * 首遍缺补丁 → error；再批波未出现的槽保持原终态。
 */
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

/**
 * 本波工人齐步后进一次：收槽补丁、对账槽状态，再决定再批或往下。
 * 不检索、不 Send（再批 Send 在 routeAfterPlanSlotJoin）。
 *
 * 再批汇合拍 → 覆盖进首遍结果 → 清 pending → planSlotPost
 * 首遍 → 全失败 / 只有 userFact → 不跑 B → planSlotPost
 *      → 有槽或 DAG → 合成 → 可选规划 B → 有 pending 再 Send，否则 planSlotPost
 */
export const runPlanSlotJoinNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  /** 本波槽工人 append；DAG 走 fanOutDagPatch，userFact 走 sideEffectAnswer */
  const patches = state.fanOutSlotPatches ?? [];
  /** 上一拍留下了再批 pending → 本拍是再批汇合，不再规划 B（全局 B ≤ 1） */
  const wasRebatchPending =
    (state.pendingGlobalRebatchSlotIds?.length ?? 0) > 0 ||
    Boolean(state.pendingGlobalRebatchDag);

  // 没有 Intake 决策：没法按槽对齐，整条槽线失败并清 pending
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

  // 工人带回的 slotRuntime 对账：超时 skipped；首遍缺补丁 error；再批未出现的槽保持原终态
  const slotRuntimeById = syncSlotRuntimes(state, patches);

  // —— 再批汇合拍：只收结果，不再跑 B ——
  if (wasRebatchPending) {
    const prior = state.fanOutSlotPatch; // 首遍已合成的总结果
    let patch: PlanSlotsPatch | null = prior;
    if (patches.length > 0) {
      if (prior) {
        // 按 slotId 覆盖再批那几槽，其余首遍结果留下
        patch = mergeRebatchPatch(state, prior, patches);
      } else {
        // 没有 prior（异常）：当首遍一样，用本波补丁从头合成
        patch = buildPatchFromWorkerPatches(state, patches, slotRuntimeById);
      }
    }
    // 本波没补丁（例如只再批了 DAG）→ 继续用 prior
    if (patches.length > 0 && patches.every((p) => Boolean(p.error)) && !prior) {
      const err = patches.find((p) => p.error)?.error ?? "槽位检索失败";
      patch = { error: err, hits: [], coverage: "none" };
    }

    logAgentOut("PlanSlotJoin", "再批汇合", {
      rebatchPatchCount: patches.length,
      pendingCleared: true,
    });

    // 清 fanOutSlotPatches，避免下一拍当新补丁；清 pending → 路由去 planSlotPost
    return {
      fanOutSlotPatch: patch,
      fanOutSlotPatches: [],
      slotRuntimeById,
      pendingGlobalRebatchSlotIds: [],
      pendingGlobalRebatchDag: false,
      pendingGlobalRebatchDagNodeIds: [],
    };
  }

  // —— 以下皆为首遍 ——

  // 本波槽全失败：整条槽线失败，不跑 B（DAG 若成功仍在 fanOutDagPatch）
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

  // 无槽补丁且无 DAG：多半只有 userFactSide；齐步后空补丁，Merge 去拼 sideEffectAnswer
  if (patches.length === 0 && !state.fanOutDagPatch) {
    return {
      fanOutSlotPatch: null,
      pendingGlobalRebatchSlotIds: [],
      pendingGlobalRebatchDag: false,
      pendingGlobalRebatchDagNodeIds: [],
    };
  }

  // 有槽 → 按 compositeSlots 顺序合成 hits / stepResults / toolResults
  // 仅 DAG、无槽 → patch 为 null；DAG 结果仍在 fanOutDagPatch，留给 Merge
  const patch =
    patches.length > 0
      ? buildPatchFromWorkerPatches(state, patches, slotRuntimeById)
      : null;

  // 日志用：对账后的每槽状态快照
  const runtimeList = (decision.compositeSlots ?? []).map(
    (s) => slotRuntimeById[String(s.id)] ?? createPendingSlot(String(s.id))
  );

  // 默认不改 plan、不再批；B 规划成功才改这些
  let nextDecision = decision;
  let pendingSlotIds: string[] = [];
  let pendingDag = false;
  let pendingDagNodeIds: string[] = [];
  let globalRebatchUsed = state.globalRebatchUsed;

  // 全局 B 三条件：环境开、本轮未用过、本波有槽或 DAG 可评估
  const globalRebatchEnabled = isGlobalRebatchEnabledFromEnv();
  const mayPlanGlobalB =
    globalRebatchEnabled &&
    !globalRebatchUsed &&
    (patches.length > 0 || Boolean(state.fanOutDagPatch));
  if (mayPlanGlobalB) {
    const dagTools = {
      ...(state.fanOutDagPatch?.toolResults ?? {}),
    };
    // 结构挑可救槽 / DAG 节点 → 一次 LLM（只允许改 query / 外搜 / abandon）
    const planned = await runGlobalRebatchPlanning({
      decision,
      userQuestion: state.userQuestion,
      patches,
      slotRuntimeById,
      policy: state.retryPolicy,
      dagToolResults: Object.keys(dagTools).length > 0 ? dagTools : null,
    });
    if (planned) {
      nextDecision = planned.decision; // 可能改了某槽 searchQuery
      pendingSlotIds = planned.rebatchSlotIds;
      pendingDag = planned.rebatchDag;
      pendingDagNodeIds = planned.rebatchDagNodeIds;
      globalRebatchUsed = true; // 本轮锁死，再进 Join 不会再规划
      // 被点名的槽打回 pending（attempts 保留），再批工人才能跑
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
    // planned 为空（无可救 / 全 abandon）→ pending 保持空，往下走
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

  // pending 非空 → routeAfterPlanSlotJoin 再 Send；否则去 planSlotPost
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
