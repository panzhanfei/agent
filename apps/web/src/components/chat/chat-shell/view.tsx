"use client";

import { ConversationLogPanel } from "@/components/chat/conversation-log-panel";
import { ChatComposer } from "./composer";
import { useChatShell } from "./hook";
import { IconEditTitle, IconPin, IconPlus, IconSidebarToggle } from "./icons";
import type { ChatShellProps } from "./interface";
import { ChatSidebar } from "./sidebar";
import { ChatThread } from "./thread";

export const ChatShell = (props: ChatShellProps) => {
  const model = useChatShell(props);
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    startNewChat,
    activeConversation,
    activeTitleRaw,
    activeTitleShort,
    activeConversationId,
    setEditingSidebarId,
    setEditSidebarTitleDraft,
    logPanelOpen,
    setLogPanelOpen,
    activeLogBundle,
    streamingTurnId,
  } = model;

  return (
    <div className="flex h-dvh bg-[#f3f4f6] text-[#1f2937]">
      <ChatSidebar model={model} />
      <main className="relative flex min-w-0 flex-1 flex-col bg-white shadow-[inset_1px_0_0_rgba(0,0,0,0.04)]">
        <header className="relative flex h-14 shrink-0 items-center border-b border-[#f0f0f0] px-4">
          <div className="relative z-10 flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="rounded-lg p-2 text-[#6b7280] hover:bg-black/[0.04] hover:text-[#374151]"
              aria-label={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
            >
              <IconSidebarToggle />
            </button>
            <button
              type="button"
              onClick={startNewChat}
              className="rounded-lg p-2 text-[#6b7280] hover:bg-black/[0.04]"
              aria-label="新对话"
            >
              <IconPlus />
            </button>
          </div>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-28 sm:px-36">
            <span className="flex max-w-full min-w-0 items-center justify-center gap-1">
              {activeConversation?.pinned ? (
                <span
                  className="pointer-events-auto shrink-0 text-amber-500"
                  title="已置顶"
                >
                  <IconPin active className="inline align-[-3px]" />
                </span>
              ) : null}
              <span
                className="truncate text-center text-[15px] font-semibold text-[#111827]"
                title={
                  activeTitleRaw !== activeTitleShort
                    ? activeTitleRaw
                    : undefined
                }
              >
                {activeTitleShort}
              </span>
              {activeConversationId ? (
                <button
                  type="button"
                  aria-label="修改标题"
                  className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#9ca3af] hover:bg-black/[0.06] hover:text-[#4f46e5]"
                  onClick={() => {
                    if (!activeConversationId) return;
                    setEditingSidebarId(activeConversationId);
                    setEditSidebarTitleDraft(activeTitleRaw);
                  }}
                >
                  <IconEditTitle className="pt-0.5" />
                </button>
              ) : null}
            </span>
            <span className="hidden text-[11px] text-[#9ca3af] sm:block">
              内容由 AI 生成，请仔细甄别
            </span>
          </div>

          <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1 text-[#9ca3af]">
            <button
              type="button"
              onClick={() => setLogPanelOpen((v) => !v)}
              disabled={!activeConversationId}
              className={[
                "rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40",
                logPanelOpen
                  ? "bg-[#eef2ff] text-[#4f46e5]"
                  : "text-[#6b7280] hover:bg-black/[0.04] hover:text-[#374151]",
              ].join(" ")}
              title="查看当前对话运行日志"
            >
              日志
            </button>
          </div>
        </header>

        <ConversationLogPanel
          open={logPanelOpen && activeConversationId != null}
          onClose={() => setLogPanelOpen(false)}
          conversationTitle={activeTitleRaw}
          bundle={activeLogBundle}
          liveTurnId={streamingTurnId}
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatThread model={model} />
          <ChatComposer model={model} />
        </div>
      </main>
    </div>
  );
};
