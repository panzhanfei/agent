/**
 * 主图 + 文件子线编排：两张平级图、两套 thread。
 * 主图不 interrupt 文件 HITL；Resume 只打文件 thread。
 */
import { Command, isGraphInterrupt } from "@langchain/langgraph";
import type {
  AgentPipelineContext,
  AgentPipelineResult,
  AgentStreamEvent,
  AssistantMessageBlock,
  DbChatTurn,
} from "@fambrain/brain-types";
import {
  createFileJob,
  expireStaleFileJobs,
  getFileJob,
  markFileJobPaused,
  markFileJobTerminal,
  supersedeFileJobs,
  type FileJobRow,
} from "@fambrain/db";
import {
  discardFileTask,
  extractPipelinePauseValue,
  fileThreadId,
  isResumablePipelinePause,
} from "@/agentflow/execution";
import {
  FILE_JOB_TTL_MS,
  getCompiledFileGraph,
  matchVaultWorkspaceUiAction,
  shouldRunFileAgent,
  type FileAgentEnvelope,
  type FileGraphState,
} from "@/agentflow/agents/sideline/file";
import { runPipelineStream } from "./stream";
import { lastUserQuestion } from "./initial-state";

const fileGenerationFromThreadId = (threadId: string): number => {
  const n = Number(threadId.split(":").pop());
  return Number.isFinite(n) ? n : 0;
};

const asEnvelope = (raw: unknown): FileAgentEnvelope | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as FileAgentEnvelope;
  if (r.task !== "workspace" && r.task !== "save_offer") return null;
  return r;
};

const prepareFileJobsForNewTurn = async (
  conversationId: string,
  userQuestion: string
): Promise<{ supersededWorkspace: boolean }> => {
  const expired = await expireStaleFileJobs(conversationId, FILE_JOB_TTL_MS);
  if (expired.length > 0) {
    discardFileTask(conversationId);
  }
  const vaultUi = matchVaultWorkspaceUiAction(userQuestion);
  if (vaultUi) {
    await supersedeFileJobs(conversationId);
    return { supersededWorkspace: true };
  }
  const n = await supersedeFileJobs(conversationId, { tasks: ["workspace"] });
  return { supersededWorkspace: n > 0 };
};

const buildFileState = (
  job: FileJobRow,
  envelope: FileAgentEnvelope
): FileGraphState => ({
  jobId: job.id,
  envelope,
  corpusUserId: job.corpusUserId,
  conversationId: job.conversationId,
  language: envelope.language,
  workspaceParams: envelope.workspaceOp ?? null,
  answer: null,
  assistantBlocks: null,
  result: null,
  error: null,
});

async function* streamFileGraph(input: {
  job: FileJobRow;
  envelope: FileAgentEnvelope;
  context: AgentPipelineContext;
  resume?: AgentPipelineContext["resume"];
  turnId: string;
}): AsyncGenerator<AgentStreamEvent, AgentPipelineResult> {
  const graph = getCompiledFileGraph();
  const threadId = input.job.fileThreadId;
  yield {
    type: "step",
    name: "file_agent",
    status: "running",
  };
  yield {
    type: "file_run",
    jobId: input.job.id,
    task: input.envelope.task,
    status: "started",
  };

  const streamInput = input.resume
    ? (new Command({
        resume: {
          kind: "vault_action" as const,
          prompt: input.resume.prompt ?? "",
          name: input.resume.name,
        },
      }) as Parameters<typeof graph.stream>[0])
    : (buildFileState(input.job, input.envelope) as Parameters<
        typeof graph.stream
      >[0]);

  let answer = "";
  let blocks: AssistantMessageBlock[] | undefined;
  let pendingPause: ReturnType<typeof extractPipelinePauseValue> = null;
  let resultAction: string | null = null;

  try {
    const stream = await graph.stream(streamInput, {
      streamMode: ["updates", "values"],
      configurable: { thread_id: threadId },
    });
    for await (const chunk of stream) {
      const [mode, payload] = chunk as ["updates" | "values", unknown];
      if (mode === "values") {
        const next = payload as Partial<FileGraphState> | null;
        if (next?.answer) answer = next.answer;
        if (next?.assistantBlocks) blocks = next.assistantBlocks;
        if (next?.result?.action) resultAction = next.result.action;
        continue;
      }
      const update = payload as Record<string, unknown>;
      if ("__interrupt__" in update) {
        pendingPause =
          extractPipelinePauseValue(update.__interrupt__) ?? pendingPause;
      }
      const nodeName = Object.keys(update)[0];
      if (!nodeName || nodeName === "__interrupt__") continue;
      const nodePatch = update[nodeName] as Partial<FileGraphState> | undefined;
      if (nodePatch?.answer) answer = nodePatch.answer;
      if (nodePatch?.assistantBlocks) blocks = nodePatch.assistantBlocks;
      if (nodePatch?.result?.action) resultAction = nodePatch.result.action;
    }
    if (!pendingPause) {
      try {
        const snap = await graph.getState({
          configurable: { thread_id: threadId },
        });
        pendingPause = extractPipelinePauseValue(
          (snap as { tasks?: unknown }).tasks
        );
      } catch {
        // ignore
      }
    }
  } catch (e) {
    if (isGraphInterrupt(e)) {
      pendingPause = extractPipelinePauseValue(
        (e as { interrupts?: unknown }).interrupts
      );
    } else {
      throw e;
    }
  }

  if (pendingPause && isResumablePipelinePause(pendingPause)) {
    await markFileJobPaused({
      id: input.job.id,
      answer: pendingPause.answer,
      blocks: pendingPause.blocks,
    });
    yield {
      type: "file_run",
      jobId: input.job.id,
      task: input.envelope.task,
      status: "paused",
    };
    yield {
      type: "paused",
      turnId: input.turnId,
      kind: "vault_wait",
      answer: pendingPause.answer,
      blocks: pendingPause.blocks,
      jobId: input.job.id,
    };
    yield { type: "step", name: "file_agent", status: "done" };
    return {
      answer: pendingPause.answer,
      blocks: pendingPause.blocks,
      turnId: input.turnId,
      paused: true,
      pauseKind: "vault_wait",
      jobId: input.job.id,
    };
  }

  const finalAnswer = answer;
  const terminal =
    resultAction === "cancelled" || resultAction === "error"
      ? "cancelled"
      : "completed";
  await markFileJobTerminal({
    id: input.job.id,
    status: terminal === "cancelled" ? "cancelled" : "completed",
    result: { action: resultAction ?? "noop", answer: finalAnswer },
    answer: finalAnswer,
  });
  yield {
    type: "file_run",
    jobId: input.job.id,
    task: input.envelope.task,
    status: "done",
  };
  if (finalAnswer) {
    yield { type: "assistant", text: finalAnswer };
  }
  yield { type: "step", name: "file_agent", status: "done" };
  return {
    answer: finalAnswer,
    blocks,
    turnId: input.turnId,
    jobId: input.job.id,
  };
}

const startNewFileJob = async (input: {
  context: AgentPipelineContext;
  envelope: FileAgentEnvelope;
  turnId: string;
}): Promise<FileJobRow> => {
  await supersedeFileJobs(input.context.conversationId);
  discardFileTask(input.context.conversationId);
  const threadId = fileThreadId(input.context.conversationId);
  return createFileJob({
    conversationId: input.context.conversationId,
    corpusUserId: input.context.corpusUserId,
    fileThreadId: threadId,
    fileGeneration: fileGenerationFromThreadId(threadId),
    sourceTurnId: input.turnId,
    task: input.envelope.task,
    envelope: input.envelope,
  });
};

async function* resumeFileAgent(
  context: AgentPipelineContext,
  turnId: string
): AsyncGenerator<AgentStreamEvent, AgentPipelineResult> {
  const resume = context.resume;
  if (!resume?.jobId) {
    yield { type: "error", message: "文件任务 Resume 缺少 jobId" };
    return {
      answer: "无法继续文件操作：缺少 jobId。",
      turnId,
    };
  }
  const job = await getFileJob(resume.jobId);
  if (!job || job.conversationId !== context.conversationId) {
    yield { type: "error", message: "文件任务不存在" };
    return { answer: "文件任务不存在或已结束。", turnId };
  }
  if (job.status !== "paused") {
    yield { type: "error", message: "文件任务不可 Resume" };
    return { answer: "文件任务已结束，无法继续。", turnId };
  }
  if (Date.now() - job.updatedAt.getTime() > FILE_JOB_TTL_MS) {
    await markFileJobTerminal({ id: job.id, status: "cancelled" });
    discardFileTask(context.conversationId);
    yield { type: "error", message: "文件任务已过期" };
    return { answer: "入库确认已过期，请重新总结或打开原文库。", turnId };
  }
  const envelope = asEnvelope(job.envelope);
  if (!envelope) {
    return { answer: "文件任务信封损坏。", turnId };
  }
  return yield* streamFileGraph({
    job,
    envelope,
    context,
    resume,
    turnId,
  });
}

export async function* orchestrateAgentStream(
  history: DbChatTurn[],
  context: AgentPipelineContext
): AsyncGenerator<AgentStreamEvent, AgentPipelineResult> {
  const turnId =
    context.turnId?.trim() ||
    `turn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  if (context.resume) {
    return yield* resumeFileAgent(context, turnId);
  }

  const prep = await prepareFileJobsForNewTurn(
    context.conversationId,
    lastUserQuestion(history)
  );

  const main = runPipelineStream(history, context);
  let mainResult: AgentPipelineResult | undefined;
  while (true) {
    const next = await main.next();
    if (next.done) {
      mainResult = next.value;
      break;
    }
    yield next.value;
  }
  if (!mainResult) {
    return { answer: "（未能生成回复，请稍后重试）", turnId };
  }
  if (mainResult.aborted || mainResult.paused) {
    return mainResult;
  }
  if (mainResult.repeatQuestionHit) {
    return mainResult;
  }

  const envelope = asEnvelope(mainResult.fileHandoff?.envelope ?? null);
  if (!envelope || !shouldRunFileAgent(envelope)) {
    if (prep.supersededWorkspace) {
      discardFileTask(context.conversationId);
    }
    return mainResult;
  }

  yield {
    type: "main_turn_complete",
    answer: mainResult.answer,
    blocks: mainResult.blocks,
    citations: mainResult.citations,
  };

  const job = await startNewFileJob({
    context,
    envelope,
    turnId: mainResult.turnId ?? turnId,
  });
  const fileResult = yield* streamFileGraph({
    job,
    envelope,
    context,
    turnId: mainResult.turnId ?? turnId,
  });

  return {
    ...mainResult,
    ...fileResult,
    answer: fileResult.paused
      ? fileResult.answer
      : [mainResult.answer, fileResult.answer].filter(Boolean).join("\n\n"),
    blocks: fileResult.blocks ?? mainResult.blocks,
    logs: [...(mainResult.logs ?? []), ...(fileResult.logs ?? [])],
    steps: [...(mainResult.steps ?? []), ...(fileResult.steps ?? [])],
  };
}
