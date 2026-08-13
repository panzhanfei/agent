/**
 * Pipeline 在线编排 SSE 壳（LangGraph 消费 + 耗时统计）。
 *
 * 职责划分：
 * - graph/：LangGraph 状态、路由、节点注册（compile.ts）
 * - brain-service/online/*：各节点业务实现
 * - 本目录：SSE 事件、步骤耗时、Pipeline 出去日志
 *
 * 对外入口：runPipelineStream()，由 HTTP routes / eval / golden 调用。
 */
import { ensureBrainServiceRuntime } from "@/config";
import {
  isPureSummarizeDecision,
  isSummarizeComposeDecision,
} from "@/agentflow/agents/online/content-summarizer/summarize-route";
import { isPureListDecision } from "@/agentflow/agents/online/corpus-lister";
import { intakeRequiresKmRetrieval } from "@/agentflow/agents/online/intake-coordinator/pipeline";
import { describeFanOutPlan } from "@/agentflow/agents/online/plan-fanout";
import { isUserFactIntent } from "@/agentflow/agents/online/user-fact";
import { buildLangGraphRunConfig } from "@fambrain/brain-config/langsmith";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type {
  AgentPipelineContext,
  AgentPipelineResult,
  AgentStreamEvent,
  AssistantMessageBlock,
  DbChatTurn,
  PipelineLogEntry,
  PipelineStepName,
  PipelineTiming,
  TurnAbortReason,
  TurnStepEvent,
} from "@fambrain/brain-types";
import {
  bindPipelineRunStore,
  createPipelineRunStore,
  drainPipelineLogQueue,
  PIPELINE_RUN_STORE_CONFIG_KEY,
  setPipelineActiveNode,
  type PipelineRunStore,
} from "@fambrain/brain-shared/pipeline-run-context";
import {
  getTurnAbortReason,
  registerTurn,
  unregisterTurn,
} from "@/agentflow/execution";
import { getCompiledPipelineGraph } from "../graph/compile";
import type { PipelineGraphState } from "../graph/state";
import { buildInitialState, lastUserQuestion } from "./initial-state";
import { PipelineTimingTracker } from "./pipeline-timing";

/** Analyst 经 LangGraph custom 通道推送的流式 chunk 形状 */
type AnalystStreamChunk =
  | { type: "thinking"; text: string }
  | { type: "assistant"; text: string }
  | { type: "ui_block"; block: AssistantMessageBlock };

/** 向 SSE 推送一条 assistant 终稿/流式文本事件 */
function* emitAssistant(answer: string): Generator<AgentStreamEvent> {
  yield { type: "assistant", text: answer };
}

const isAnalystStreamChunk = (value: unknown): value is AnalystStreamChunk => {
  if (!value || typeof value !== "object") return false;
  const chunk = value as {
    type?: unknown;
    text?: unknown;
    block?: unknown;
  };
  if (chunk.type === "ui_block") {
    return chunk.block != null && typeof chunk.block === "object";
  }
  return (
    (chunk.type === "thinking" || chunk.type === "assistant") &&
    typeof chunk.text === "string"
  );
};

const analystChunkToStreamEvent = (
  chunk: AnalystStreamChunk
): AgentStreamEvent => {
  if (chunk.type === "ui_block") {
    return { type: "ui_block", block: chunk.block };
  }
  return chunk;
};

/** 从 finalState.hits 提取去重后的 corpus path，供 AgentPipelineResult */
const retrievalPathsFromState = (state: PipelineGraphState): string[] => {
  const paths = state.hits
    .map((h) => h.path?.trim())
    .filter((p): p is string => Boolean(p));
  return [...new Set(paths)];
};

const upsertCollectedStep = (
  steps: TurnStepEvent[],
  event: TurnStepEvent
): void => {
  const idx = steps.findIndex((s) => s.name === event.name);
  if (idx >= 0) {
    steps[idx] = { ...steps[idx], ...event };
    return;
  }
  steps.push(event);
};

/** 组装 Pipeline「出去」日志与调试用的结构化摘要（intent、hits、route、timing 等） */
const summarizePipelineOut = (
  state: PipelineGraphState,
  answer: string,
  timing: PipelineTiming
) => ({
  answerPreview: answer.length > 400 ? `${answer.slice(0, 400)}…` : answer,
  exitEarly: state.exitEarly,
  intent: state.decision?.intent ?? null,
  requiresKmRetrieval:
    state.decision && intakeRequiresKmRetrieval(state.decision)
      ? true
      : state.decision
        ? false
        : null,
  hitCount: state.hits.length,
  coverage: state.coverage,
  checkerPassed: state.checkerPassed,
  retryCount: state.retryCount,
  confidenceTier: state.confidenceTier,
  repeatQuestionHit: state.repeatQuestionHit,
  retrievalCacheHit: state.retrievalCacheHit,
  retrievalCacheSlotHits: state.retrievalCacheSlotHits,
  routeMode: state.decision?.routeMode ?? null,
  composeMode: state.decision?.composeMode ?? null,
  pathPlanCounts: state.decision?.pathPlan
    ? {
        km: state.decision.pathPlan.steps.filter((s) => s.kind === "km").length,
        list: state.decision.pathPlan.steps.filter((s) => s.kind === "list")
          .length,
        tool: state.decision.pathPlan.steps.filter((s) => s.kind === "tool")
          .length,
        dag: state.decision.pathPlan.steps.filter((s) => s.kind === "dag")
          .length,
      }
    : null,
  stepResultCount: state.stepResults?.length ?? 0,
  routeReason: state.decision?.routeReason ?? null,
  routePlanSource: state.decision?.routePlanSource ?? null,
  retrievalPlanGuardReason:
    (state.decision as { retrievalPlanGuardReason?: string } | null)
      ?.retrievalPlanGuardReason ?? null,
  compositeSlotCount: state.compositeSubResults?.length ?? 0,
  compositeFacetCacheHits: state.compositeFacetCacheHits ?? null,
  citationCount: state.citations?.length ?? 0,
  citationPaths: (state.citations ?? []).slice(0, 8).map((c) => c.path),
  error: state.error,
  hitPaths: state.hits.map((h) => h.path),
  timing,
  tokens: timing.tokens
    ? {
        total: timing.tokens.totalTokens,
        prompt: timing.tokens.promptTokens,
        completion: timing.tokens.completionTokens,
        estimated: timing.tokens.estimated ?? false,
        byNode: timing.tokens.byNode ?? {},
      }
    : null,
});

/**
 * 本轮 Pipeline 收尾：刷剩余 pipeline_log → 合并 token 统计 → yield pipeline_timing。
 * 返回最终 PipelineTiming 供 AgentPipelineResult 与「出去」日志使用。
 */
const finishPipeline = function* (
  timing: PipelineTimingTracker,
  collectedLogs: PipelineLogEntry[],
  runStore: PipelineRunStore
): Generator<AgentStreamEvent, PipelineTiming> {
  bindPipelineRunStore(runStore);
  yield* flushPipelineLogs(collectedLogs, runStore);
  const tokenSnap = runStore.tokenTracker.snapshot();
  const snapshot: PipelineTiming = {
    ...timing.snapshot(),
    ...(tokenSnap.totalTokens > 0 ? { tokens: tokenSnap } : {}),
  };
  yield { type: "pipeline_timing", timing: snapshot };
  return snapshot;
};

/** 把本轮 logQueue 积压的 Agent 日志批量 yield 为 pipeline_log SSE 事件 */
function* flushPipelineLogs(
  collectedLogs: PipelineLogEntry[],
  runStore: PipelineRunStore
): Generator<AgentStreamEvent> {
  bindPipelineRunStore(runStore);
  for (const entry of drainPipelineLogQueue(runStore)) {
    collectedLogs.push(entry);
    yield { type: "pipeline_log", entry };
  }
}

/** 在线 Pipeline 对外入口 */
export async function* runPipelineStream(
  history: DbChatTurn[],
  context: AgentPipelineContext
): AsyncGenerator<AgentStreamEvent, AgentPipelineResult> {
  return yield* runPipelineStreamInner(history, context);
}

/**
 * Pipeline 主流程：LangGraph stream 消费循环。
 * 业务节点在 brain-service/online/*；图拓扑在 graph/compile.ts。
 */
async function* runPipelineStreamInner(
  history: DbChatTurn[],
  context: AgentPipelineContext
): AsyncGenerator<AgentStreamEvent, AgentPipelineResult> {
  ensureBrainServiceRuntime();
  /** 本轮 ALS 仓库：入口创建并持有引用（generator yield 后 getStore 可能丢） */
  const runStore = createPipelineRunStore();
  bindPipelineRunStore(runStore);
  const userQuestion = lastUserQuestion(history);
  const timing = new PipelineTimingTracker();
  const collectedLogs: PipelineLogEntry[] = [];
  const collectedSteps: TurnStepEvent[] = [];
  const graph = getCompiledPipelineGraph();
  const input = buildInitialState(history, context, userQuestion);
  const turnId = input.turnId;
  const turnController = registerTurn({
    turnId,
    conversationId: context.conversationId,
    actorUserId: context.actorUserId,
  });
  const turnSignal = turnController.signal;
  let finalState: PipelineGraphState = input;
  let activeStep: PipelineStepName | null = "prepare_turn_start";
  /** 并行 fan-out 时可同时 running 多个 step */
  const runningSteps = new Set<PipelineStepName>(["prepare_turn_start"]);
  timing.markNodeStart("prepare_turn_start");
  setPipelineActiveNode("prepare_turn_start");
  upsertCollectedStep(collectedSteps, {
    name: "prepare_turn_start",
    status: "running",
  });
  yield { type: "step", name: "prepare_turn_start", status: "running" };
  bindPipelineRunStore(runStore);

  const finishAborted = function* (
    reason: TurnAbortReason
  ): Generator<AgentStreamEvent, AgentPipelineResult> {
    finalState = { ...finalState, turnAborted: true };
    yield { type: "aborted", turnId, reason };
    const pipelineTiming = yield* finishPipeline(timing, collectedLogs, runStore);
    logAgentOut(
      "Pipeline",
      "出去",
      summarizePipelineOut(
        finalState,
        finalState.answer ?? "",
        pipelineTiming
      )
    );
    return {
      answer: finalState.answer ?? "",
      blocks: finalState.assistantBlocks ?? undefined,
      repeatQuestionHit: finalState.repeatQuestionHit,
      retrievalCacheHit: finalState.retrievalCacheHit,
      compositeFacetCacheHits: finalState.compositeFacetCacheHits,
      timing: pipelineTiming,
      retrievalPaths: retrievalPathsFromState(finalState),
      logs: [...collectedLogs],
      steps: [...collectedSteps],
      aborted: true,
      abortReason: reason,
      turnId,
    };
  };

  try {
  bindPipelineRunStore(runStore);
  const langsmithCfg = buildLangGraphRunConfig({
    conversationId: context.conversationId,
    corpusUserId: context.corpusUserId,
    actorUserId: context.actorUserId,
    userQuestion,
  });
  const stream = await graph.stream(
    input as Parameters<typeof graph.stream>[0],
    {
      streamMode: ["updates", "values", "custom"],
      signal: turnSignal,
      ...langsmithCfg,
      configurable: {
        ...((langsmithCfg as { configurable?: Record<string, unknown> })
          .configurable ?? {}),
        [PIPELINE_RUN_STORE_CONFIG_KEY]: runStore,
      },
    }
  );
  /** 结束 step：记耗时、yield step done（支持并行多 step） */
  const finishStep = function* (name: PipelineStepName) {
    if (!runningSteps.has(name) && activeStep !== name) return;
    const durationMs = timing.markNodeEnd(name);
    runningSteps.delete(name);
    if (activeStep === name) {
      activeStep = null;
      setPipelineActiveNode(
        runningSteps.size > 0
          ? ([...runningSteps].at(-1) as PipelineStepName)
          : null
      );
    }
    upsertCollectedStep(collectedSteps, {
      name,
      status: "done",
      ...(durationMs !== undefined ? { durationMs } : {}),
    });
    yield {
      type: "step",
      name,
      status: "done",
      ...(durationMs !== undefined ? { durationMs } : {}),
    } as const;
    yield* flushPipelineLogs(collectedLogs, runStore);
  };
  /** 开始 step：支持并行（不强制结束其它 running） */
  const startStep = function* (name: PipelineStepName) {
    if (runningSteps.has(name)) return;
    timing.markNodeStart(name);
    runningSteps.add(name);
    setPipelineActiveNode(name);
    activeStep = name;
    upsertCollectedStep(collectedSteps, { name, status: "running" });
    yield { type: "step", name, status: "running" } as const;
  };
  const streamIter = stream[Symbol.asyncIterator]();
  while (true) {
    bindPipelineRunStore(runStore);
    const iterNext = await streamIter.next();
    if (iterNext.done) break;
    const chunk = iterNext.value;
    bindPipelineRunStore(runStore);
    if (turnSignal.aborted) {
      const reason = getTurnAbortReason(turnId) ?? "cancelled";
      return yield* finishAborted(reason);
    }
    const [mode, payload] = chunk as ["updates" | "values" | "custom", unknown];
    if (mode === "values") {
      finalState = payload as PipelineGraphState;
      continue;
    }
    if (mode === "custom") {
      if (isAnalystStreamChunk(payload)) {
        timing.markFirstToken();
        yield analystChunkToStreamEvent(payload);
      }
      continue;
    }
    const update = payload as Record<string, Partial<PipelineGraphState>>;
    const nodeName = Object.keys(update)[0];
    if (!nodeName) continue;
    const nodePatch = update[nodeName];
    if (nodePatch) {
      finalState = { ...finalState, ...nodePatch };
    }
    if (nodeName === "prepareTurnStart") {
      yield* finishStep("prepare_turn_start");
      yield* flushPipelineLogs(collectedLogs, runStore);
      yield* startStep("repeat_question_guard");
      continue;
    }
    if (nodeName === "repeatQuestionGuard") {
      yield* finishStep("repeat_question_guard");
      yield* flushPipelineLogs(collectedLogs, runStore);
      if (finalState.repeatQuestionHit) {
        yield* startStep("repeat_respond_early");
      } else {
        yield* startStep("prepare_pipeline_memory");
      }
      continue;
    }
    if (nodeName === "preparePipelineMemory") {
      yield* finishStep("prepare_pipeline_memory");
      yield* flushPipelineLogs(collectedLogs, runStore);
      if (finalState.error && finalState.exitEarly) {
        yield { type: "error", message: finalState.error };
        const answer =
          finalState.answer ?? "（准备对话上下文失败，请稍后重试）";
        timing.markFirstToken();
        const pipelineTiming = yield* finishPipeline(timing, collectedLogs, runStore);
        logAgentOut(
          "Pipeline",
          "出去",
          summarizePipelineOut(finalState, answer, pipelineTiming)
        );
        yield* emitAssistant(answer);
        return {
          answer,
          repeatQuestionHit: false,
          retrievalCacheHit: false,
          timing: pipelineTiming,
          logs: [...collectedLogs],
          steps: [...collectedSteps],
        };
      }
      yield* startStep("intake");
      continue;
    }
    if (nodeName === "repeatRespondEarly") {
      yield* finishStep("repeat_respond_early");
      yield* flushPipelineLogs(collectedLogs, runStore);
      yield* startStep("persist_turn_end");
      continue;
    }
    if (nodeName === "intake") {
      yield* finishStep("intake");
      yield* flushPipelineLogs(collectedLogs, runStore);
      if (finalState.error) {
        yield { type: "error", message: finalState.error };
        const answer =
          finalState.answer ??
          "（模型调用失败：请确认本地 Ollama 已启动且模型已拉取）";
        timing.markFirstToken();
        const pipelineTiming = yield* finishPipeline(timing, collectedLogs, runStore);
        logAgentOut(
          "Pipeline",
          "出去",
          summarizePipelineOut(finalState, answer, pipelineTiming)
        );
        yield* emitAssistant(answer);
        return {
          answer,
          repeatQuestionHit: finalState.repeatQuestionHit,
          retrievalCacheHit: finalState.retrievalCacheHit,
          timing: pipelineTiming,
          logs: [...collectedLogs],
          steps: [...collectedSteps],
        };
      }
      const decision = finalState.decision;
      if (decision && isUserFactIntent(decision.intent)) {
        yield* startStep("user_fact");
      } else if (decision && isPureSummarizeDecision(decision)) {
        yield* startStep("content_summarizer");
      } else if (decision && isPureListDecision(decision)) {
        yield* startStep("list_retrieve");
      } else if (decision && decision.routeMode === "planFanOut") {
        yield* startStep("plan_cache_resolve");
      } else if (
        decision &&
        (intakeRequiresKmRetrieval(decision) ||
          (decision.pathPlan &&
            (decision.pathPlan.steps?.length ?? 0) > 0))
      ) {
        const fan = describeFanOutPlan(finalState);
        if (fan.hasKm) yield* startStep("km_retrieve");
        if (fan.hasList) yield* startStep("list_retrieve");
        if (fan.hasVaultWorkspace) yield* startStep("vault_workspace");
        if (fan.hasDag) yield* startStep("plan_dag");
        if (fan.hasSideRemember) yield* startStep("user_fact");
        if (
          fan.hasKm ||
          fan.hasList ||
          fan.hasVaultWorkspace ||
          fan.hasSideRemember
        ) {
          yield* startStep("plan_slot_join");
        }
      }
      continue;
    }
    if (nodeName === "planCacheResolve") {
      yield* finishStep("plan_cache_resolve");
      const fan = describeFanOutPlan(finalState);
      if (fan.hasKm) yield* startStep("km_retrieve");
      if (fan.hasList) yield* startStep("list_retrieve");
      if (fan.hasVaultWorkspace) yield* startStep("vault_workspace");
      if (fan.hasDag) yield* startStep("plan_dag");
      if (fan.hasSideRemember) yield* startStep("user_fact");
      if (
        fan.hasKm ||
        fan.hasList ||
        fan.hasVaultWorkspace ||
        fan.hasSideRemember
      ) {
        yield* startStep("plan_slot_join");
      }
      continue;
    }
    if (nodeName === "listRetriever") {
      yield* finishStep("list_retrieve");
      yield {
        type: "retrieval_meta",
        cacheHit: false,
      };
      yield* startStep("content_organizer");
      if (finalState.error) {
        yield { type: "error", message: finalState.error };
      }
      continue;
    }
    if (nodeName === "userFact") {
      yield* finishStep("user_fact");
      if (finalState.answer) {
        timing.markFirstToken();
        yield* emitAssistant(finalState.answer);
      }
      if (finalState.error) {
        yield { type: "error", message: finalState.error };
      }
      yield* startStep("persist_turn_end");
      continue;
    }
    if (nodeName === "userFactSide") {
      // 多槽并行时不提前 finish km/list；join 统一收口
      yield* finishStep("user_fact");
      continue;
    }
    if (nodeName === "kmRetrieve") {
      // 每槽一个 kmRetrieve：等 planSlotJoin 再 finish km_retrieve
      continue;
    }
    if (nodeName === "listRetrieve") {
      continue;
    }
    if (nodeName === "vaultWorkspace") {
      continue;
    }
    if (nodeName === "planSlotJoin") {
      if (runningSteps.has("km_retrieve")) {
        yield* finishStep("km_retrieve");
      }
      if (runningSteps.has("list_retrieve")) {
        yield* finishStep("list_retrieve");
      }
      if (runningSteps.has("vault_workspace")) {
        yield* finishStep("vault_workspace");
      }
      yield* finishStep("plan_slot_join");
      yield* startStep("plan_slot_post");
      continue;
    }
    if (nodeName === "planSlotPost") {
      yield* finishStep("plan_slot_post");
      if (!runningSteps.has("plan_dag")) {
        yield* startStep("plan_merge");
      }
      continue;
    }
    if (nodeName === "planDag") {
      yield* finishStep("plan_dag");
      if (!runningSteps.has("plan_slot_post") && !runningSteps.has("plan_slot_join")) {
        yield* startStep("plan_merge");
      }
      continue;
    }
    if (nodeName === "planMerge") {
      yield* finishStep("plan_merge");
      // 兜底：收掉仍标 running 的 join/post（竞态）
      if (runningSteps.has("plan_slot_join")) {
        yield* finishStep("plan_slot_join");
      }
      if (runningSteps.has("plan_slot_post")) {
        yield* finishStep("plan_slot_post");
      }
      if (runningSteps.has("km_retrieve")) {
        yield* finishStep("km_retrieve");
      }
      if (runningSteps.has("list_retrieve")) {
        yield* finishStep("list_retrieve");
      }
      yield {
        type: "retrieval_meta",
        cacheHit: Boolean(finalState.retrievalCacheHit),
      };
      yield* startStep("content_organizer");
      if (finalState.error) {
        yield { type: "error", message: finalState.error };
      }
      continue;
    }
    if (nodeName === "contentSummarizer") {
      yield* finishStep("content_summarizer");
      if (finalState.exitEarly && finalState.answer) {
        timing.markFirstToken();
        yield* emitAssistant(finalState.answer);
      } else if (!finalState.exitEarly) {
        yield* startStep("analyst");
      }
      continue;
    }
    if (nodeName === "contentOrganizer") {
      yield* finishStep("content_organizer");
      const decision = finalState.decision;
      if (decision && isSummarizeComposeDecision(decision)) {
        yield* startStep("content_summarizer");
      } else {
        yield* startStep("analyst");
      }
      continue;
    }
    if (nodeName === "analyst") {
      yield* finishStep("analyst");
      if (finalState.error) {
        yield { type: "error", message: finalState.error };
      }
      yield* startStep("persist_turn_end");
      continue;
    }
    if (nodeName === "respondEarly") {
      if (activeStep) {
        const durationMs = timing.markNodeEnd(activeStep);
        upsertCollectedStep(collectedSteps, {
          name: activeStep,
          status: "done",
          ...(durationMs !== undefined ? { durationMs } : {}),
        });
        yield {
          type: "step",
          name: activeStep,
          status: "done",
          ...(durationMs !== undefined ? { durationMs } : {}),
        };
        activeStep = null;
      }
      yield* startStep("persist_turn_end");
      continue;
    }
    if (nodeName === "persistTurnEnd") {
      yield* finishStep("persist_turn_end");
      yield* flushPipelineLogs(collectedLogs, runStore);
      continue;
    }
  }
  if (turnSignal.aborted) {
    const reason = getTurnAbortReason(turnId) ?? "cancelled";
    return yield* finishAborted(reason);
  }
  if (activeStep) {
    const durationMs = timing.markNodeEnd(activeStep);
    upsertCollectedStep(collectedSteps, {
      name: activeStep,
      status: "done",
      ...(durationMs !== undefined ? { durationMs } : {}),
    });
    yield {
      type: "step",
      name: activeStep,
      status: "done",
      ...(durationMs !== undefined ? { durationMs } : {}),
    };
  }
  if (finalState.exitEarly && finalState.answer) {
    timing.markFirstToken();
    yield* emitAssistant(finalState.answer);
  }
  const answer =
    finalState.answer ?? "（未能生成回复，请稍后重试）";
  if (!finalState.exitEarly && !finalState.answer) {
    timing.markFirstToken();
    yield* emitAssistant(answer);
  }
  const pipelineTiming = yield* finishPipeline(timing, collectedLogs, runStore);
  logAgentOut(
    "Pipeline",
    "出去",
    summarizePipelineOut(finalState, answer, pipelineTiming)
  );
  const blocks = finalState.assistantBlocks ?? undefined;
  const citations = finalState.citations?.length
    ? finalState.citations
    : undefined;
  if (blocks?.length || citations?.length) {
    yield {
      type: "assistant_message",
      message: {
        plainText: answer,
        blocks: blocks ?? [],
        ...(citations?.length ? { citations } : {}),
      },
    };
  }
  if (citations?.length) {
    yield { type: "citations", citations };
  }
  return {
    answer,
    blocks,
    citations,
    repeatQuestionHit: finalState.repeatQuestionHit,
    retrievalCacheHit: finalState.retrievalCacheHit,
    compositeFacetCacheHits: finalState.compositeFacetCacheHits,
    timing: pipelineTiming,
    retrievalPaths: retrievalPathsFromState(finalState),
    logs: [...collectedLogs],
    steps: [...collectedSteps],
    turnId,
  };
  } catch (e) {
    if (turnSignal.aborted) {
      const reason = getTurnAbortReason(turnId) ?? "cancelled";
      return yield* finishAborted(reason);
    }
    throw e;
  } finally {
    unregisterTurn(turnId);
  }
}
