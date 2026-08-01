/**
 * 进全局 B 的候选：只信结构信号 + 预算，不猜问句。
 */
import type { PlanSlotWorkerPatch } from "../interface";
import type { ExecutionPlanNode, PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/interface";
import {
  canAttemptAgain,
  type RetryPolicy,
  type SlotRuntimeState,
} from "@/agentflow/execution";

/** 槽是否结构上可救且未满预算 */
export const isSlotStructurallySalvageable = (
  patch: PlanSlotWorkerPatch | undefined,
  runtime: SlotRuntimeState,
  policy: RetryPolicy
): boolean => {
  if (!canAttemptAgain(runtime, policy)) return false;
  if (runtime.status === "aborted" || runtime.status === "awaiting_human") {
    return false;
  }
  if (patch?.error) return true;
  if (runtime.status === "skipped") return true;
  if (patch?.toolResult && !patch.toolResult.ok) return true;
  if (patch?.sub.coverage === "none") return true;
  const hasFact = Boolean(patch?.sub.recalledFact?.value);
  const hasHits = (patch?.sub.hits.length ?? 0) > 0;
  const toolOk = Boolean(patch?.toolResult?.ok);
  if (!hasHits && !hasFact && !toolOk && runtime.status === "done") {
    return true;
  }
  return false;
};

export const selectSalvageableSlotIds = (input: {
  slotIds: readonly string[];
  patches: readonly PlanSlotWorkerPatch[];
  slotRuntimeById: Record<string, SlotRuntimeState>;
  policy: RetryPolicy;
}): string[] => {
  const patchById = new Map(
    input.patches.map((p) => [String(p.slotId), p] as const)
  );
  return input.slotIds.filter((id) => {
    const runtime =
      input.slotRuntimeById[id] ??
      ({
        slotId: id,
        status: "skipped",
        reason: "error",
        attempts: 0,
        degraded: false,
        startedAtMs: null,
        finishedAtMs: null,
      } satisfies SlotRuntimeState);
    return isSlotStructurallySalvageable(patchById.get(id), runtime, input.policy);
  });
};

/**
 * DAG 失败节点：ok:false / insufficientEvidence；
 * hard-deps skip 不单独进 B（应修上游节点）。
 */
export const selectSalvageableDagNodeIds = (
  plan: readonly ExecutionPlanNode[],
  results: PipelineToolResults | null | undefined
): string[] => {
  if (!results || plan.length === 0) return [];
  return plan
    .filter((node) => {
      const r = results[node.id];
      if (!r) return false;
      if (r.skipped && r.skipReason === "deps") return false;
      if (!r.ok) return true;
      if (r.insufficientEvidence) return true;
      return false;
    })
    .map((n) => n.id);
};
