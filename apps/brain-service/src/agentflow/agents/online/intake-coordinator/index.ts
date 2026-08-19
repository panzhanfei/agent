/**
 * IntakeCoordinator 对外 API；子目录经各自 index 聚合。
 * 端到端：LLM 产出 pathPlan.steps[]；代码合法化并派生 compositeSlots / answerOrder。
 */

import { completeIntakeCoordinator } from "./llm";
import {
  matchUiEnumerationPrompt,
  resolveEnumerationPagination,
} from "@/agentflow/agents/online/corpus-lister/enumeration";
import { resolveVaultWorkspaceUiBypass } from "@/agentflow/agents/sideline/file/workspace";
import {
  applyAttachmentAction,
  buildEnumerationListDecision,
  buildIncompleteUtteranceDecision,
  applyIntakeChitchatGuard,
  buildPureChitchatDecision,
} from "./guards";
import {
  historySupportsContinuation,
  lastSubstantiveUserQuestion,
  normalizeIntakeUtterance,
  rewriteLastUserTurn,
  shouldShortCircuitIncompleteUtterance,
  surfaceForSingleCharSignal,
  utteranceCodePointLength,
} from "./signals";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import {
  buildEarlyExitRoutedDecision,
  parseIntakeDecision,
  runIntakePipeline,
} from "./pipeline";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

export {
  prompt,
  parseIntakeRoutingDecision,
  type IntakeCoreferenceStatus,
  type IntakeIdentityField,
  type IntakeRetrievalPlanItem,
  type IntakeRoutingDecision,
} from "./contract";

export {
  ENUMERATION_ACTION_PROMPTS,
  enumerationActionPrompt,
  matchUiEnumerationPrompt,
  findLastEnumerationBlock,
  resolveEnumerationPagination,
  type EnumerationControl,
  type EnumerationListKind,
  type SlotExecutor,
} from "@/agentflow/agents/online/corpus-lister/enumeration";

export {
  decisionRequestsExternalLink,
  hasExplicitMultipartStructure,
  hasStaleMultipartFromDecision,
  isPureSocialUtterance,
  rewriteLastUserTurn,
  shouldRetryCoreferenceMerge,
  shouldShortCircuitIncompleteUtterance,
  buildMergedCoreferenceQuestion,
  normalizeIntakeUtterance,
  surfaceForSingleCharSignal,
} from "./signals";

export { completeIntakeCoordinator } from "./llm";

export {
  intakeRequiresKmRetrieval,
  resolveIntakeGraphRouteMode,
  runIntakePipeline,
  buildEarlyExitRoutedDecision,
  isClarifyEarlyExit,
  isRespondEarlyIntent,
  parseIntakeDecision,
  defaultIntakeDecision,
  type RunIntakePipelineResult,
} from "./pipeline";

export {
  applyIntakeChitchatGuard,
  applyPureSocialUtteranceGuard,
  buildIncompleteUtteranceDecision,
  buildPureChitchatDecision,
  DEFAULT_CHITCHAT_BRIEF_REPLY,
  INCOMPLETE_UTTERANCE_BRIEF_REPLY,
  applyEnumerationSlotGuard,
  buildEnumerationListDecision,
  type EnumerationListIntent,
  type IntakeRouteMode,
  type RoutedIntakeDecision,
} from "./guards";

export {
  looksLikeMultiPartQuestion,
  resolveEffectiveQueryType,
  splitQuestionUnits,
  EMPLOYERS_SLOT,
  EXTERNAL_LINK_SLOT,
  IDENTITY_SLOT,
  PROJECTS_SLOT,
  canonicalizePlanItem,
  facetTemplateForQueryType,
  planItemToSlot,
  dedupePlanByFacet,
  normalizePlanItemFromSchema,
  planFacetKey,
  isProjectEnumeration,
  resolveEnumerationTarget,
  type CompositeFacetId,
  type CompositeRetrievalSlot,
  type CompositeSlotId,
  type CompositeRoutePlanSource,
  type EnumerationTarget,
} from "./composite";

export {
  applyPathPlanGuard,
  compilePathPlan,
  pathPlanToCompositeSlots,
  emptyPathPlan,
  defaultComposeMode,
  countPathPlan,
  pathPlanBuckets,
  stepsOfKind,
  expandHybridMultiSourceTemplate,
  extractCompanyHint,
  decisionSuggestsHybridDag,
  topicsSuggestWebSource,
  applyToolPlanGuard,
  enrichCompositeSlots,
  enrichRetrievalPlan,
  deriveCompositeSlotsFromPathPlan,
  deriveRetrievalPlanFromPathPlan,
  exclusiveVaultWorkspacePlan,
  legalizePathPlan,
  legalizeAnswerOrder,
  legalizeComposeMode,
  normalizePathPlanSteps,
  fillListPagesInPathPlan,
  isPathPlanEmpty,
  type ComposeMode,
  type PathPlan,
  type PathKind,
  type StepResult,
  type DagTemplateId,
  type ExecutionStep,
} from "./path-plan";

/**
 * LangGraph `intake` 节点（位于 preparePipelineMemory 之后、routeAfterIntake 之前）。
 */
export const runIntakeNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  try {
    const rawQuestion = state.userQuestion;
    const normalizedQuestion =
      normalizeIntakeUtterance(rawQuestion) || rawQuestion.trim() || rawQuestion;

    /**
     * 超短无问号（码点 ≤2，如「你好」）：结构短路 → chitchat。
     * 非口语词表；有问号 / 可续上文 不触发。
     */
    const shortSurface = surfaceForSingleCharSignal(normalizedQuestion);
    const shortLen = utteranceCodePointLength(shortSurface);
    if (
      shortLen >= 1 &&
      shortLen <= 2 &&
      !/[？?]/.test(normalizedQuestion) &&
      !historySupportsContinuation(state.intakeHistory)
    ) {
      const chitchat = applyIntakeChitchatGuard(buildPureChitchatDecision());
      logAgentOut("IntakeCoordinator", "短路_超短无问号", {
        userQuestion: rawQuestion,
        normalizedQuestion,
        shortLen,
      });
      return {
        decision: buildEarlyExitRoutedDecision(chitchat),
      };
    }

    if (
      shouldShortCircuitIncompleteUtterance(
        normalizedQuestion,
        state.intakeHistory
      )
    ) {
      const incomplete = buildIncompleteUtteranceDecision();
      logAgentOut("IntakeCoordinator", "短路_单字残缺", {
        userQuestion: rawQuestion,
        normalizedQuestion,
      });
      return {
        decision: buildEarlyExitRoutedDecision(incomplete),
      };
    }

    const uiControl = matchUiEnumerationPrompt(rawQuestion);
    if (
      uiControl &&
      (uiControl.action === "continue" || uiControl.action === "exhaustive")
    ) {
      const { page, pageSize } = resolveEnumerationPagination(
        uiControl,
        state.history
      );
      return {
        decision: buildEnumerationListDecision({
          userQuestion: rawQuestion,
          listKind: uiControl.listKind,
          listIntent:
            uiControl.action === "continue" ? "continue" : "exhaustive",
          page,
          pageSize,
        }),
      };
    }

    const vaultDecision = resolveVaultWorkspaceUiBypass(rawQuestion);
    if (vaultDecision) {
      logAgentOut("IntakeCoordinator", "路由_vault_workspace_ui", {
        userQuestion: rawQuestion,
      });
      return {
        decision: vaultDecision,
      };
    }

    const effectiveQuestion = normalizedQuestion;
    const intakeHistoryForLlm =
      normalizedQuestion !== rawQuestion.trim()
        ? rewriteLastUserTurn(state.intakeHistory, normalizedQuestion)
        : state.intakeHistory;

    // 结构化上下文字段（输入增强）；废除 Plan 级指代拼接二次 LLM
    const priorSubstantive =
      historySupportsContinuation(state.intakeHistory)
        ? lastSubstantiveUserQuestion(state.intakeHistory, effectiveQuestion)
        : null;

    const turnAttachments = state.context.turnAttachments ?? [];
    const attachmentBrief =
      turnAttachments.length > 0
        ? turnAttachments
            .map((a, i) => {
              const preview = a.text.trim().slice(0, 240);
              return `${i + 1}. ${a.fileName}（${a.textLength ?? a.text.length} 字）预览：${preview}${a.text.length > 240 ? "…" : ""}`;
            })
            .join("\n")
        : null;

    let intakeRaw = await completeIntakeCoordinator(intakeHistoryForLlm, {
      memoryBlock: state.memoryBlock,
      intakeHistory: intakeHistoryForLlm,
      priorSubstantiveQuestion: priorSubstantive,
      attachmentBrief,
    });

    if (!parseIntakeDecision(intakeRaw)) {
      logAgentOut("IntakeCoordinator", "JSON格式修复重试", {
        userQuestion: effectiveQuestion,
        rawPreview:
          intakeRaw.length > 200 ? `${intakeRaw.slice(0, 200)}…` : intakeRaw,
      });
      intakeRaw = await completeIntakeCoordinator(intakeHistoryForLlm, {
        memoryBlock: state.memoryBlock,
        intakeHistory: intakeHistoryForLlm,
        priorSubstantiveQuestion: priorSubstantive,
        attachmentBrief,
        jsonFormatRepair: true,
      });
    }

    /** 有附件时先按 attachmentAction 改写，再 legalize（避免空 plan 被误 clarify） */
    let pipelineRaw = intakeRaw;
    if (turnAttachments.length > 0) {
      const parsed =
        parseIntakeDecision(intakeRaw) ??
        ({
          intent: "clarify",
          searchQuery: "",
          subTasks: [],
          topics: ["attachment"],
          language: "zh" as const,
          confidence: 0.5,
          queryType: null,
          clarifyingQuestion: null,
          briefReply: null,
          retrievalPlan: [],
          pathPlan: { steps: [] },
          answerOrder: [],
          composeMode: "qa" as const,
          userFactKey: null,
          userFactLabel: null,
          userFactValue: null,
          attachmentAction: null,
          coreference: "none" as const,
        });
      const applied = await applyAttachmentAction({
        decision: parsed,
        attachments: turnAttachments,
        attachmentBatchId: state.context.attachmentBatchId,
        actorUserId: state.context.actorUserId,
        corpusUserId: state.context.corpusUserId,
      });
      logAgentOut("IntakeCoordinator", "附件动作归一", {
        attachmentAction: applied.decision.attachmentAction ?? null,
        earlyExit: applied.earlyExit,
        fileCount: turnAttachments.length,
      });
      if (applied.earlyExit) {
        return {
          decision: buildEarlyExitRoutedDecision(applied.decision),
          ...(applied.answer ? { answer: applied.answer } : {}),
        };
      }
      pipelineRaw = JSON.stringify(applied.decision);
    }

    const { decision } = await runIntakePipeline({
      intakeRaw: pipelineRaw,
      userQuestion: effectiveQuestion,
      intakeHistory: intakeHistoryForLlm,
      history: state.history,
    });
    return { decision };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "入口接线员调用失败，请确认 Ollama 可用";
    return {
      error: msg,
      answer: "（模型调用失败：请确认本地 Ollama 已启动且模型已拉取）",
      exitEarly: true,
    };
  }
};
