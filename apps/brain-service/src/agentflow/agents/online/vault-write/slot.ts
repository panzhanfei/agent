/**
 * vault_workspace 单槽工人（无 interrupt）：测试 / 缺槽兜底。
 * 图主路径 Pause 在包根 runVaultWorkspaceNode。
 */
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { parseVaultWorkspaceParams, runVaultWorkspaceOp } from "./ops";

const emptySub = (
  slotId: string,
  label: string,
  notes: string | null,
  blocks?: CompositeSubRetrieval["assistantBlocks"]
): CompositeSubRetrieval => ({
  slot: slotId,
  label,
  hits: [],
  coverage: notes ? "sufficient" : "none",
  notes,
  cacheHit: false,
  facetAnswerCacheHit: false,
  dataSource: "corpus",
  assistantBlocks: blocks ?? undefined,
});

export const runVaultWorkspaceSlotWorker = async (
  state: PipelineGraphState
): Promise<PlanSlotWorkerPatch> => {
  const slot = resolveActiveSlot(state);
  const slotId = state.activeSlotId ?? "unknown";
  if (!slot) {
    return {
      slotId,
      executor: "vault_workspace",
      sub: emptySub(slotId, "unknown", "缺少 activeSlotId"),
      stepResult: {
        stepId: slotId,
        pathKind: "vault_workspace",
        label: "unknown",
        hits: [],
        coverage: "none",
        notes: "缺少 activeSlotId",
        confidenceTier: null,
        enumerationMeta: null,
        cacheHit: false,
      },
      error: "缺少 activeSlotId",
    };
  }

  const params =
    parseVaultWorkspaceParams(
      (slot.params as Record<string, unknown> | undefined) ?? null
    ) ??
    ({
      operation: "list",
      targetPath: String(slot.searchQuery ?? "").trim() || "",
    } as const);

  const result = await runVaultWorkspaceOp({
    corpusUserId: state.context.corpusUserId,
    params,
    language: state.decision?.language === "en" ? "en" : "zh",
  });

  const notes = result.answer;
  const step: StepResult = {
    stepId: String(slot.id),
    pathKind: "vault_workspace",
    label: slot.label,
    hits: [],
    coverage: "sufficient",
    notes,
    confidenceTier: "high",
    enumerationMeta: null,
    cacheHit: false,
  };

  return {
    slotId: String(slot.id),
    executor: "vault_workspace",
    sub: emptySub(String(slot.id), slot.label, notes, result.blocks),
    stepResult: step,
    error: result.ok ? null : result.error ?? "vault_workspace_failed",
  };
};
