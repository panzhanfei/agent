/**
 * summarizeSlot：复合路径子步总结（kind=summarize / dataSource=user_text）。
 * 整轮 composeMode=summarize 仍走 contentSummarizer 终稿节点。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import { emitBudgetedSlotPatch } from "@/agentflow/agents/online/plan-fanout/slot-budget";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import { formatSummaryAsAnswer } from "../format";
import { summarizeContent } from "../summarize";

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
  dataSource: "user_text",
});

const summarizeStepResult = (
  slotId: string,
  label: string,
  notes: string | null,
  ok: boolean
): StepResult => ({
  stepId: slotId,
  pathKind: "summarize",
  label,
  hits: [],
  coverage: ok ? "sufficient" : "none",
  notes,
  confidenceTier: null,
  enumerationMeta: null,
  cacheHit: false,
});

export const runSummarizeSlotWorker = async (
  state: PipelineGraphState
): Promise<PlanSlotWorkerPatch> => {
  const slot = resolveActiveSlot(state);
  const slotId = state.activeSlotId ?? "unknown";
  if (!slot) {
    return {
      slotId,
      executor: "summarize",
      sub: emptySub(slotId, "unknown", "缺少 activeSlotId"),
      stepResult: summarizeStepResult(slotId, "unknown", "缺少 activeSlotId", false),
      error: "缺少 activeSlotId",
    };
  }

  const language = state.decision?.language ?? "zh";
  const text =
    slot.searchQuery?.trim() ||
    state.userQuestion.trim() ||
    "";

  if (!text) {
    const notes =
      language === "en"
        ? "No text to summarize for this step."
        : "本步没有可总结的正文。";
    return {
      slotId: String(slot.id),
      executor: "summarize",
      sub: emptySub(String(slot.id), slot.label, notes),
      stepResult: summarizeStepResult(String(slot.id), slot.label, notes, false),
      error: null,
    };
  }

  try {
    const summary = await summarizeContent({
      text,
      sourceLabel: slot.label,
      language,
    });
    const answer = formatSummaryAsAnswer(summary);
    const toolResult: ToolRunResult = {
      toolId: "synthesize_merge",
      label: slot.label,
      ok: true,
      answer,
      citations: [],
      hits: [],
      insufficientEvidence: false,
      confidence: 0.85,
    };
    const sub: CompositeSubRetrieval = {
      slot: slot.id,
      facetKey: `summarize:${slot.id}`,
      label: slot.label,
      hits: [],
      coverage: "sufficient",
      notes: answer,
      cacheHit: false,
      facetAnswerCacheHit: false,
      dataSource: "user_text",
    };
    return {
      slotId: String(slot.id),
      executor: "summarize",
      sub,
      stepResult: {
        ...summarizeStepResult(String(slot.id), slot.label, answer, true),
        toolOutput: toolResult,
      },
      toolResult,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "子步总结失败";
    const sub = emptySub(String(slot.id), slot.label, msg);
    return {
      slotId: String(slot.id),
      executor: "summarize",
      sub,
      stepResult: summarizeStepResult(String(slot.id), slot.label, msg, false),
      error: msg,
    };
  }
};

/** LangGraph summarizeSlot 节点 */
export const runSummarizeSlotNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("ContentSummarizer", "进入", {
    via: "summarizeSlot",
    slotId: state.activeSlotId,
  });

  const out = await emitBudgetedSlotPatch(state, "summarize", () =>
    runSummarizeSlotWorker(state)
  );
  const patch = out.fanOutSlotPatches?.[0];

  logAgentOut("ContentSummarizer", "出去", {
    via: "summarizeSlot",
    slotId: patch?.slotId ?? state.activeSlotId,
    ok: Boolean(patch?.toolResult?.ok),
    slotStatus: patch?.slotRuntime?.status ?? null,
  });

  return out;
};
