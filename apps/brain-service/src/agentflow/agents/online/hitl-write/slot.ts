/**
 * corpus_edit 单槽工人：
 * - open / update 无正文 → 只读预览（B）
 * - create（可空）/ update 有正文 / clear → HITL 子图 interrupt（A/C）
 */
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import {
  buildCorpusEditAppliedActions,
  buildCorpusEditAppliedAnswer,
  buildCorpusEditOpenAnswer,
  buildCorpusEditPendingActions,
  buildCorpusEditPendingAnswer,
} from "./compose-actions";
import type { CorpusEditOperation } from "./interface";
import { corpusEditErrorMessage } from "./errors";
import { startCorpusEditGraph } from "./graph";
import { parseEditOperation, targetPathFromStep } from "./propose";
import { previewCorpusMarkdown } from "./preview";
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
  coverage: notes ? "sufficient" : "none",
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
  coverage: "sufficient",
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

const okStep = (
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
    checkerNotes: "ok",
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
  const language = state.decision?.language === "en" ? "en" : "zh";

  if (!slot) {
    const notes = corpusEditErrorMessage("missing_active_slot", language);
    return {
      slotId,
      executor: "corpus_edit",
      sub: emptySub(slotId, "unknown", notes),
      stepResult: failedStep(slotId, "unknown", notes),
      error: null,
    };
  }

  const step = state.decision?.pathPlan?.steps.find(
    (s) => String(s.id) === String(slot.id)
  );
  const targetPath = targetPathFromStep({
    searchQuery: slot.searchQuery,
    params: step?.params ?? slot.params ?? null,
  });
  let operation = parseEditOperation(
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
    const notes = corpusEditErrorMessage("missing_target_path", language);
    return {
      slotId: String(slot.id),
      executor: "corpus_edit",
      sub: emptySub(String(slot.id), slot.label, notes),
      stepResult: failedStep(String(slot.id), slot.label, notes),
      error: null,
    };
  }

  // B：显式 open，或 update 无正文 → 只读预览（禁止空覆盖）
  if (operation === "update" && !afterContent.trim()) {
    operation = "open";
  }

  if (operation === "open") {
    const preview = await previewCorpusMarkdown({
      corpusUserId: state.context.corpusUserId,
      targetPath,
    });
    if (!preview.ok) {
      const notes = corpusEditErrorMessage(preview.error, language);
      return {
        slotId: String(slot.id),
        executor: "corpus_edit",
        sub: emptySub(String(slot.id), slot.label, notes),
        stepResult: failedStep(String(slot.id), slot.label, notes),
        error: null,
      };
    }
    const notes = buildCorpusEditOpenAnswer(
      preview.repoPath,
      preview.content,
      language
    );
    return {
      slotId: String(slot.id),
      executor: "corpus_edit",
      sub: emptySub(String(slot.id), slot.label, notes),
      stepResult: okStep(String(slot.id), slot.label, notes),
      error: null,
      slotRuntime: {
        slotId: String(slot.id),
        status: "done",
        reason: null,
        attempts: 1,
        degraded: false,
        startedAtMs: Date.now(),
        finishedAtMs: Date.now(),
      },
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
      const parsedOp = parseEditOperation(interrupted.operation ?? operation);
      const writeOp = (
        parsedOp === "open" ? "update" : parsedOp
      ) as Exclude<CorpusEditOperation, "open">;
      const proposal: CorpusEditProposalView = {
        proposalId: interrupted.proposalId,
        threadId,
        repoPath: interrupted.repoPath ?? targetPath,
        operation: writeOp,
        beforeContent: String(interrupted.beforeContent ?? ""),
        afterContent: String(interrupted.afterContent ?? ""),
        status: "pending_review",
      };
      const notes = buildCorpusEditPendingAnswer(proposal, language);
      const blocks = [
        buildCorpusEditPendingActions(proposal.proposalId, writeOp, language),
      ];
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
      const repoPath = String(
        (result as { targetPath?: string }).targetPath ?? targetPath
      );
      const writeOp = (
        operation === "open" ? "update" : operation
      ) as Exclude<CorpusEditOperation, "open">;
      const notes = buildCorpusEditAppliedAnswer(
        repoPath,
        result.indexedChunks ?? 0,
        writeOp,
        language
      );
      const blocks = [
        buildCorpusEditAppliedActions(repoPath, writeOp, language),
      ];
      return {
        slotId: String(slot.id),
        executor: "corpus_edit",
        sub: emptySub(String(slot.id), slot.label, notes, blocks),
        stepResult: okStep(String(slot.id), slot.label, notes),
        error: null,
      };
    }

    const errCode = result?.error ?? "corpus_edit_failed";
    const notes = corpusEditErrorMessage(String(errCode), language);
    return {
      slotId: String(slot.id),
      executor: "corpus_edit",
      sub: emptySub(String(slot.id), slot.label, notes),
      stepResult: failedStep(String(slot.id), slot.label, notes),
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "corpus_edit 失败";
    return {
      slotId: String(slot.id),
      executor: "corpus_edit",
      sub: emptySub(String(slot.id), slot.label, msg),
      stepResult: failedStep(String(slot.id), slot.label, msg),
      error: null,
    };
  }
};
