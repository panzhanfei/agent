"use client";

import { AssistantMessageContent } from "@/components/chat/assistant-message-content";
import { LinkifiedText } from "@/components/chat/linkified-text";
import { MessageCitations } from "@/components/chat/message-citations";
import { MessageRetrievalFeedback } from "@/components/chat/message-retrieval-feedback";
import { SUGGESTIONS } from "../helpers";
import { AssistantPendingRow } from "../pending-row";
import { MessageTimingLine } from "../timing";
import type { ChatThreadProps } from "./interface";

export const ChatThread = ({ model }: ChatThreadProps) => {
  const {
    sendingFirstOnNewChat,
    showingEmptyLanding,
    applySuggestion,
    messagesLoading,
    messages,
    messagesError,
    setMessagesRetryTick,
    messagesScrollRef,
    handleChatAction,
    staleActionKeys,
    turnInFlight,
    hasLiveStreamUi,
    latestAssistantMessageId,
    editingMessageId,
    editDraft,
    setEditDraft,
    cancelEditUserMessage,
    commitEditUserMessage,
    sendBusy,
    streamingTurnId,
    canEditUserMessage,
    beginEditUserMessage,
    activeConversationId,
    showAssistantPending,
    thinkingPanelVisible,
    streamThinking,
    streamAnswerPreview,
    streamBlocks,
  } = model;

  return (
    <>
          {sendingFirstOnNewChat ? (
            <div className="flex flex-1 items-center justify-center px-6 pb-[18vh] text-[14px] text-[#9ca3af]">
              正在写入会话并调用模型…
            </div>
          ) : showingEmptyLanding ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[18vh]">
              <h1 className="text-center text-[26px] font-semibold tracking-tight text-[#111827] sm:text-[30px]">
                有什么我能帮你的吗？
              </h1>
              <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="rounded-2xl border border-[#e5e7eb] bg-[#fafafa] px-4 py-3 text-left text-[14px] leading-snug text-[#374151] transition-colors hover:border-[#d1d5db] hover:bg-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : messagesLoading && messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-[14px] text-[#9ca3af]">
              加载消息中…
            </div>
          ) : messagesError && messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-[14px] text-red-600">
              <span>{messagesError}</span>
              <button
                type="button"
                onClick={() => setMessagesRetryTick((n) => n + 1)}
                className="text-[13px] font-medium text-[#4f46e5] hover:underline"
              >
                重试
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 pb-[18vh]">
              <h1 className="text-center text-[26px] font-semibold tracking-tight text-[#111827] sm:text-[30px]">
                有什么我能帮你的吗？
              </h1>
              <p className="mt-2 text-[14px] text-[#9ca3af]">该会话暂无消息</p>
            </div>
          ) : (
            <div
              ref={messagesScrollRef}
              className="flex-1 overflow-y-auto px-4 py-6 sm:px-8"
            >
              <ul className="mx-auto flex max-w-3xl flex-col gap-4">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={[
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "group relative max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap",
                        m.role === "user"
                          ? "bg-[#4f46e5] text-white"
                          : "bg-[#f3f4f6] text-[#111827]",
                      ].join(" ")}
                    >
                      {m.role === "assistant" ? (
                        <AssistantMessageContent
                          content={m.content}
                          blocks={m.blocks}
                          onAction={handleChatAction}
                          staleActionKeys={staleActionKeys}
                          messageId={m.id}
                          messageCreatedAt={m.createdAt ?? null}
                          actionsLocked={
                            turnInFlight ||
                            hasLiveStreamUi ||
                            m.id !== latestAssistantMessageId
                          }
                        />
                      ) : editingMessageId === m.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={3}
                            className="w-full min-w-[240px] resize-y rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-[14px] text-white outline-none placeholder:text-white/50"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEditUserMessage}
                              disabled={sendBusy}
                              className="rounded-full px-3 py-1 text-[12px] text-white/80 hover:bg-white/10"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              onClick={() => void commitEditUserMessage()}
                              disabled={
                                !editDraft.trim() ||
                                editDraft.trim() === m.content.trim() ||
                                (sendBusy && !streamingTurnId)
                              }
                              className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#4f46e5] disabled:opacity-40"
                            >
                              保存并重问
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <LinkifiedText text={m.content} />
                          {canEditUserMessage(m) ? (
                            <button
                              type="button"
                              onClick={() => beginEditUserMessage(m)}
                              disabled={sendBusy && !streamingTurnId}
                              className="mt-2 block text-[11px] text-white/70 underline-offset-2 hover:text-white hover:underline disabled:opacity-40"
                            >
                              编辑
                            </button>
                          ) : null}
                        </>
                      )}
                      {m.role === "assistant" && m.timing ? (
                        <MessageTimingLine timing={m.timing} />
                      ) : null}
                      {m.role === "assistant" ? (
                        <MessageCitations citations={m.citations} />
                      ) : null}
                      {m.role === "assistant" && activeConversationId ? (
                        <MessageRetrievalFeedback
                          messageId={m.id}
                          conversationId={activeConversationId}
                          retrievalPaths={m.retrievalPaths}
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
                {showAssistantPending ? <AssistantPendingRow /> : null}
                {(sendBusy || streamingTurnId != null) &&
                thinkingPanelVisible &&
                streamThinking.trim() ? (
                  <li className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-[15px] leading-relaxed shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                        思考过程
                      </div>
                      <pre className="mt-2 max-h-[min(40vh,320px)] overflow-y-auto whitespace-pre-wrap text-[13px] text-amber-950/90">
                        {streamThinking}
                      </pre>
                    </div>
                  </li>
                ) : null}
                {streamAnswerPreview || streamBlocks.length > 0 ? (
                  <li className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-2.5 text-[15px] leading-relaxed text-[#374151] whitespace-pre-wrap">
                      <AssistantMessageContent
                        content={streamAnswerPreview}
                        blocks={streamBlocks}
                        onAction={handleChatAction}
                        staleActionKeys={staleActionKeys}
                        actionsLocked={turnInFlight}
                      />
                    </div>
                  </li>
                ) : null}
              </ul>
            </div>
          )}
    </>
  );
};
