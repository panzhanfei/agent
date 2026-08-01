import type {
  AgentPipelineContext,
  AgentPipelineResult,
  DbChatTurn,
  AssistantMessageBlock,
  TurnAbortReason,
} from "@fambrain/brain-types";
import { encodeSseEvent, sseResponse } from "@/lib/chat/sse";
import {
  appendAssistantMessage,
  appendUserMessage,
  maybeUpdateConversationTitle,
  upsertTurnTrace,
} from "@fambrain/db";
import { streamAgentPipeline } from "./brain-service-client";
import {
  appendInflightPreview,
  buildCancelledAssistantContent,
  getInflightTurn,
  registerInflightTurn,
  unregisterInflightTurn,
  type InflightTurn,
} from "./inflight-turns";

type UiRole = "user" | "assistant";
const mapRole = (role: string): UiRole => {
  return role === "user" ? "user" : "assistant";
};
const streamEventName = (ev: { type: string }): string => {
  return ev.type;
};

const persistCancelledTurn = async (
  entry: InflightTurn,
  reason: TurnAbortReason
): Promise<{
  assistantMessage: {
    id: string;
    role: UiRole;
    content: string;
  } | null;
}> => {
  if (entry.finalized) {
    return { assistantMessage: null };
  }
  entry.finalized = true;
  entry.reason = reason;

  let assistantRow: Awaited<ReturnType<typeof appendAssistantMessage>> | null =
    null;
  if (reason === "cancelled") {
    const content = buildCancelledAssistantContent(entry.preview);
    if (content) {
      assistantRow = await appendAssistantMessage(
        entry.conversationId,
        content
      );
    }
  }

  const messageId = assistantRow?.id ?? `turn:${entry.turnId}`;
  try {
    await upsertTurnTrace({
      userId: entry.userId,
      conversationId: entry.conversationId,
      messageId,
      userMessageId: entry.userMessageId,
      userQuestion: entry.userQuestion,
      status: reason,
      timing: entry.timing,
      entries: entry.logs,
      steps: entry.steps,
      error: reason === "cancelled" ? "user_cancelled" : "superseded",
    });
  } catch (traceErr) {
    console.error("upsertTurnTrace (cancel) failed", traceErr);
  }

  return {
    assistantMessage: assistantRow
      ? {
          id: assistantRow.id,
          role: mapRole(assistantRow.role),
          content: assistantRow.content,
        }
      : null,
  };
};

export const createPostMessageStreamResponse = (options: {
  conversationId: string;
  userContent: string;
  conversationTitle: string;
  history: DbChatTurn[];
  pipelineContext: AgentPipelineContext;
  authToken: string;
  turnId: string;
  clientSignal?: AbortSignal;
}): Response => {
  const turnId = options.turnId;
  const inflight = registerInflightTurn({
    turnId,
    conversationId: options.conversationId,
    userId: options.pipelineContext.actorUserId,
    userQuestion: options.userContent,
  });

  if (options.clientSignal) {
    const onClientAbort = () => {
      if (!inflight.brainAbort.signal.aborted) {
        inflight.brainAbort.abort();
      }
    };
    if (options.clientSignal.aborted) onClientAbort();
    else {
      options.clientSignal.addEventListener("abort", onClientAbort, {
        once: true,
      });
    }
  }

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(encodeSseEvent(event, payload));
      };
      let userRow: Awaited<ReturnType<typeof appendUserMessage>>;
      try {
        userRow = await appendUserMessage(
          options.conversationId,
          options.userContent
        );
        inflight.userMessageId = userRow.id;
        await maybeUpdateConversationTitle(
          options.conversationId,
          options.conversationTitle,
          options.userContent
        );
        send("meta", {
          turnId,
          userMessage: {
            id: userRow.id,
            role: mapRole(userRow.role),
            content: userRow.content,
          },
        });
        const historyWithUser: DbChatTurn[] = [
          ...options.history,
          { role: "user", content: options.userContent },
        ];
        const gen = streamAgentPipeline(
          historyWithUser,
          { ...options.pipelineContext, turnId },
          options.authToken,
          { signal: inflight.brainAbort.signal }
        );
        let pipelineResult: AgentPipelineResult | undefined;
        let sawAborted = false;
        while (true) {
          if (inflight.finalized || inflight.brainAbort.signal.aborted) {
            break;
          }
          const next = await gen.next();
          if (next.done) {
            pipelineResult = next.value;
            break;
          }
          const ev = next.value;
          if (ev.type === "assistant" && typeof ev.text === "string") {
            appendInflightPreview(turnId, ev.text);
          }
          if (ev.type === "pipeline_log" && ev.entry) {
            inflight.logs.push(ev.entry);
          }
          if (ev.type === "step") {
            const idx = inflight.steps.findIndex((s) => s.name === ev.name);
            const step = {
              name: ev.name,
              status: ev.status,
              ...(ev.durationMs !== undefined
                ? { durationMs: ev.durationMs }
                : {}),
            };
            if (idx >= 0) inflight.steps[idx] = step;
            else inflight.steps.push(step);
          }
          if (ev.type === "pipeline_timing" && ev.timing) {
            inflight.timing = ev.timing;
          }
          if (ev.type === "aborted") {
            sawAborted = true;
            const reason = ev.reason;
            const persisted = await persistCancelledTurn(inflight, reason);
            send("aborted", {
              turnId,
              reason,
              assistantMessage: persisted.assistantMessage,
            });
            continue;
          }
          send(streamEventName(ev), ev);
        }

        if (inflight.finalized || sawAborted || pipelineResult?.aborted) {
          if (!inflight.finalized && pipelineResult?.aborted) {
            const reason = pipelineResult.abortReason ?? "cancelled";
            const persisted = await persistCancelledTurn(inflight, reason);
            send("aborted", {
              turnId,
              reason,
              assistantMessage: persisted.assistantMessage,
            });
          }
          send("done", {
            turnId,
            aborted: true,
            reason: inflight.reason ?? pipelineResult?.abortReason ?? "cancelled",
            userMessage: {
              id: userRow.id,
              role: mapRole(userRow.role),
              content: userRow.content,
            },
          });
          return;
        }

        if (inflight.brainAbort.signal.aborted && !inflight.finalized) {
          const reason: TurnAbortReason = inflight.reason ?? "cancelled";
          const persisted = await persistCancelledTurn(inflight, reason);
          send("aborted", {
            turnId,
            reason,
            assistantMessage: persisted.assistantMessage,
          });
          send("done", {
            turnId,
            aborted: true,
            reason,
            userMessage: {
              id: userRow.id,
              role: mapRole(userRow.role),
              content: userRow.content,
            },
          });
          return;
        }

        const finalContent =
          pipelineResult?.answer?.trim() ||
          "（模型未返回助手文本：请确认 Ollama 已启动且模型已拉取）";
        appendInflightPreview(turnId, finalContent);
        send("ready", {
          answer: finalContent,
          timing: pipelineResult?.timing,
        });
        const assistantRow = await appendAssistantMessage(
          options.conversationId,
          finalContent,
          pipelineResult?.retrievalPaths?.length ||
            pipelineResult?.blocks?.length
            ? {
                ...(pipelineResult?.retrievalPaths?.length
                  ? { retrievalPaths: pipelineResult.retrievalPaths }
                  : {}),
                ...(pipelineResult?.blocks?.length
                  ? { blocks: pipelineResult.blocks as AssistantMessageBlock[] }
                  : {}),
              }
            : undefined
        );
        inflight.finalized = true;
        try {
          await upsertTurnTrace({
            userId: options.pipelineContext.actorUserId,
            conversationId: options.conversationId,
            messageId: assistantRow.id,
            userMessageId: userRow.id,
            userQuestion: options.userContent,
            status: "done",
            timing: pipelineResult?.timing ?? null,
            entries: pipelineResult?.logs ?? inflight.logs,
            steps: pipelineResult?.steps ?? inflight.steps,
          });
        } catch (traceErr) {
          console.error("upsertTurnTrace failed", traceErr);
        }
        send("done", {
          turnId,
          userMessage: {
            id: userRow.id,
            role: mapRole(userRow.role),
            content: userRow.content,
          },
          assistantMessage: {
            id: assistantRow.id,
            role: mapRole(assistantRow.role),
            content: assistantRow.content,
            retrievalPaths: pipelineResult?.retrievalPaths,
            blocks: pipelineResult?.blocks,
          },
          timing: pipelineResult?.timing,
        });
      } catch (e) {
        if (inflight.brainAbort.signal.aborted || inflight.finalized) {
          if (!inflight.finalized) {
            const reason: TurnAbortReason = inflight.reason ?? "cancelled";
            try {
              const persisted = await persistCancelledTurn(inflight, reason);
              send("aborted", {
                turnId,
                reason,
                assistantMessage: persisted.assistantMessage,
              });
            } catch {
              //
            }
          }
          try {
            send("done", {
              turnId,
              aborted: true,
              reason: inflight.reason ?? "cancelled",
            });
          } catch {
            //
          }
          return;
        }
        console.error(e);
        const msg =
          e instanceof Error
            ? e.message
            : "模型流式调用失败，请确认本地 Ollama 可用";
        try {
          send("error", { error: msg });
        } catch {
          //
        }
      } finally {
        unregisterInflightTurn(turnId);
        try {
          controller.close();
        } catch {
          //
        }
      }
    },
    cancel() {
      if (!inflight.brainAbort.signal.aborted) {
        inflight.brainAbort.abort();
      }
    },
  });
  return sseResponse(readable);
};

/** 供 cancel 路由：中止 Brain fetch + 按 reason 落库（与 SSE 断流双保险） */
export const finalizeInflightTurnCancel = async (input: {
  turnId: string;
  userId: string;
  conversationId: string;
  reason: TurnAbortReason;
}): Promise<{
  ok: boolean;
  found: boolean;
  forbidden?: boolean;
  assistantMessage: {
    id: string;
    role: UiRole;
    content: string;
  } | null;
}> => {
  const turn = getInflightTurn(input.turnId);
  if (!turn) {
    return { ok: true, found: false, assistantMessage: null };
  }
  if (
    turn.userId !== input.userId ||
    turn.conversationId !== input.conversationId
  ) {
    return { ok: false, found: true, forbidden: true, assistantMessage: null };
  }
  turn.reason = input.reason;
  if (!turn.brainAbort.signal.aborted) {
    turn.brainAbort.abort();
  }
  const persisted = await persistCancelledTurn(turn, input.reason);
  return {
    ok: true,
    found: true,
    assistantMessage: persisted.assistantMessage,
  };
};
