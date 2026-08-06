/**
 * corpus_edit 单槽工人：启动 HITL 子图 → interrupt → awaiting_human + actions。
 */
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import {
  buildCorpusEditPendingActions,
  buildCorpusEditPendingAnswer,
} from "./compose-actions";
import { startCorpusEditGraph } from "./graph";
import { parseEditOperation, targetPathFromStep } from "./propose";
import type { CorpusEditProposalView } from "./interface";

const emptySub = (
  slotId: string,
  label: string,
  notes: string | null,
  blocks?: AssistantMessageBlock[]
): CompositeSubRetrieval => ({
  slot: slotId,
  label,
  hits: [],
  coverage: blocks?.length ? "sufficient" : "none",
  notes,
  cacheHit: false,
  facetAnswerCacheHit: false,
  dataSource: "corpus",
  assistantBlocks: blocks,
});

const failedStep = (
  slotId: string,
  label: string,
  notes: string
): StepResult => ({
  stepId: slotId,
  pathKind: "corpus_edit",
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

const pendingStep = (
  slotId: string,
  label: string,
  notes: string
): StepResult => ({
  stepId: slotId,
  pathKind: "corpus_edit",
  label,
  hits: [],
  coverage: "sufficient",
  notes,
  confidenceTier: "high",
  enumerationMeta: null,
  cacheHit: false,
  fc: {
    passed: true,
    refinedSearchQuery: null,
    issues: [],
    checkerNotes: "awaiting_human",
  },
});

type InterruptPayload = {
  proposalId?: string;
  repoPath?: string;
  operation?: string;
  beforeContent?: string;
  afterContent?: string;
};

const extractInterrupt = (result: unknown): InterruptPayload | null => {
  if (!result || typeof result !== "object") return null;
  const interrupts = (result as { __interrupt__?: Array<{ value?: unknown }> })
    .__interrupt__;
  const value = interrupts?.[0]?.value;
  if (!value || typeof value !== "object") return null;
  return value as InterruptPayload;
};

export const runCorpusEditSlotWorker = async (
  state: PipelineGraphState
): Promise<PlanSlotWorkerPatch> => {
  const slot = resolveActiveSlot(state);
  const slotId = state.activeSlotId ?? "unknown";
  if (!slot) {
    return {
      slotId,
      executor: "corpus_edit",
      sub: emptySub(slotId, "unknown", "缺少 activeSlotId"),
      stepResult: failedStep(slotId, "unknown", "缺少 activeSlotId"),
      error: "缺少 activeSlotId",
    };
  }

  const step = state.decision?.pathPlan?.steps.find(
    (s) => String(s.id) === String(slot.id)
  );
  const targetPath = targetPathFromStep({
    searchQuery: slot.searchQuery,
    params: step?.params ?? slot.params ?? null,
  });
  const operation = parseEditOperation(
    step?.params?.operation ?? slot.params?.operation
  );
  const afterContent = String(
    step?.params?.afterContent ??
      step?.params?.after_content ??
      slot.params?.afterContent ??
      ""
  );
  const threadId =
    state.context.conversationId && state.turnId
      ? `corpus-edit:${state.context.conversationId}:${state.turnId}:${slot.id}`
      : `corpus-edit:${state.context.corpusUserId}:${slot.id}:${Date.now()}`;

  if (!targetPath) {
    const notes = "corpus_edit 步缺少结构化 targetPath / searchQuery。";
    return {
      slotId: String(slot.id),
      executor: "corpus_edit",
      sub: emptySub(String(slot.id), slot.label, notes),
      stepResult: failedStep(String(slot.id), slot.label, notes),
      error: notes,
    };
  }

  try {
    const result = await startCorpusEditGraph({
      userId: state.context.actorUserId,
      corpusUserId: state.context.corpusUserId,
      conversationId: state.context.conversationId,
      turnId: state.turnId,
      threadId,
      targetPath,
      operation,
      afterContent,
    });

    const interrupted = extractInterrupt(result);
    if (interrupted?.proposalId) {
      const proposal: CorpusEditProposalView = {
        proposalId: interrupted.proposalId,
        threadId,
        repoPath: interrupted.repoPath ?? targetPath,
        operation: parseEditOperation(interrupted.operation ?? operation),
        beforeContent: String(interrupted.beforeContent ?? ""),
        afterContent: String(interrupted.afterContent ?? ""),
        status: "pending_review",
      };
      const language = state.decision?.language === "en" ? "en" : "zh";
      const notes = buildCorpusEditPendingAnswer(proposal, language);
      const blocks = [buildCorpusEditPendingActions(proposal.proposalId)];
      return {
        slotId: String(slot.id),
        executor: "corpus_edit",
        sub: emptySub(String(slot.id), slot.label, notes, blocks),
        stepResult: pendingStep(String(slot.id), slot.label, notes),
        error: null,
        slotRuntime: {
          slotId: String(slot.id),
          status: "awaiting_human",
          reason: null,
          attempts: 1,
          degraded: false,
          startedAtMs: Date.now(),
          finishedAtMs: Date.now(),
        },
      };
    }

    if (result?.applied) {
      const notes = `已写入 ${result.proposalId ?? targetPath}（chunks=${result.indexedChunks ?? 0}）`;
      return {
        slotId: String(slot.id),
        executor: "corpus_edit",
        sub: emptySub(String(slot.id), slot.label, notes),
        stepResult: pendingStep(String(slot.id), slot.label, notes),
        error: null,
      };
    }

    const err = result?.error ?? "corpus_edit_failed";
    return {
      slotId: String(slot.id),
      executor: "corpus_edit",
      sub: emptySub(String(slot.id), slot.label, err),
      stepResult: failedStep(String(slot.id), slot.label, err),
      error: err,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "corpus_edit 失败";
    return {
      slotId: String(slot.id),
      executor: "corpus_edit",
      sub: emptySub(String(slot.id), slot.label, msg),
      stepResult: failedStep(String(slot.id), slot.label, msg),
      error: msg,
    };
  }
};
