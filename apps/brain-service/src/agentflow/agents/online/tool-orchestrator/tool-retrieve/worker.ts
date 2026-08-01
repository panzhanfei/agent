/**
 * tool 单槽工人：按 toolId 调 runExecutionPlanNode。
 */
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type {
  DataSource,
  ExecutionPlanNode,
  ToolRunId,
  ToolRunResult,
} from "../interface";
import { defaultDataSourceForStandaloneTool } from "../interface";
import { runExecutionPlanNode } from "../execute";

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
  dataSource: null,
});

const toolStepResult = (
  slotId: string,
  label: string,
  run: ToolRunResult | null,
  notes: string | null
): StepResult => ({
  stepId: slotId,
  pathKind: "tool",
  label,
  hits: run?.hits ?? [],
  coverage: run && run.ok && !run.insufficientEvidence ? "sufficient" : "none",
  notes,
  confidenceTier: null,
  enumerationMeta: null,
  toolOutput: run,
  cacheHit: false,
  fc: {
    passed: true,
    refinedSearchQuery: null,
    issues: [],
    checkerNotes: "tool_run_skip_fc",
  },
});

export const runToolSlotWorker = async (
  state: PipelineGraphState
): Promise<PlanSlotWorkerPatch> => {
  const slot = resolveActiveSlot(state);
  const slotId = state.activeSlotId ?? "unknown";
  if (!slot) {
    return {
      slotId,
      executor: "tool",
      sub: emptySub(slotId, "unknown", "缺少 activeSlotId"),
      stepResult: toolStepResult(slotId, "unknown", null, "缺少 activeSlotId"),
      error: "缺少 activeSlotId",
    };
  }

  const toolId = slot.toolId as ToolRunId | null;
  if (!toolId) {
    const notes = "tool 步缺少 toolId";
    return {
      slotId: String(slot.id),
      executor: "tool",
      sub: emptySub(String(slot.id), slot.label, notes),
      stepResult: toolStepResult(String(slot.id), slot.label, null, notes),
      error: notes,
    };
  }

  const dataSource: DataSource =
    (slot.dataSource as DataSource | null) ??
    defaultDataSourceForStandaloneTool(toolId);

  const node: ExecutionPlanNode = {
    id: String(slot.id),
    label: slot.label,
    dataSource,
    toolId,
    searchQuery: slot.searchQuery,
    webQuery: slot.searchQuery,
    targetLang: slot.targetLang ?? null,
    sourceLang: slot.sourceLang ?? null,
    queryType: slot.queryType,
    topics: slot.topics,
    field: slot.identityField ?? null,
    deps: [],
  };

  try {
    const run = await runExecutionPlanNode(node, {
      state,
      prior: state.toolResults ?? {},
    });
    const sub: CompositeSubRetrieval = {
      slot: slot.id,
      facetKey: `tool:${toolId}`,
      label: slot.label,
      hits: run.hits,
      coverage:
        run.ok && !run.insufficientEvidence
          ? "sufficient"
          : run.hits.length > 0
            ? "partial"
            : "none",
      notes: run.answer,
      cacheHit: false,
      facetAnswerCacheHit: false,
      dataSource,
    };
    return {
      slotId: String(slot.id),
      executor: "tool",
      sub,
      stepResult: toolStepResult(String(slot.id), slot.label, run, run.answer),
      toolResult: run,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "tool 执行失败";
    const sub = emptySub(String(slot.id), slot.label, msg);
    return {
      slotId: String(slot.id),
      executor: "tool",
      sub,
      stepResult: toolStepResult(String(slot.id), slot.label, null, msg),
      error: msg,
    };
  }
};
