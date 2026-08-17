"use client";

import Link from "next/link";
import { IconChat, IconEditTitle, IconPin, IconTrash } from "../icons";
import { shortConversationTitle } from "../helpers";
import type { ChatSidebarProps } from "./interface";

export const ChatSidebar = ({ model }: ChatSidebarProps) => {
  const {
    sidebarCollapsed,
    listLoading,
    listError,
    conversations,
    loadConversations,
    activeConversationId,
    setActiveConversationId,
    editingSidebarId,
    setEditingSidebarId,
    editSidebarTitleDraft,
    setEditSidebarTitleDraft,
    patchConversation,
    setPreferEmptySession,
    setStaleActionKeys,
    setStreamThinking,
    setStreamAnswerPreview,
    setStreamBlocks,
    togglePinOptimistic,
    deleteConversationOptimistic,
    viewer,
  } = model;

  return (
      <aside
        className={[
          "flex shrink-0 flex-col border-r border-[#e5e7eb] bg-[#f9fafb] transition-[width]",
          sidebarCollapsed
            ? "w-0 overflow-hidden border-r-0 opacity-0"
            : "w-[260px] opacity-100",
        ].join(" ")}
        aria-hidden={sidebarCollapsed}
      >
        <div className="flex h-14 items-center gap-2 border-b border-[#eceeef] px-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef2ff] text-sm font-semibold text-[#4f46e5]">
            FB
          </div>
          <span className="truncate text-[15px] font-semibold tracking-tight text-[#111827]">
            FamBrain
          </span>
        </div>

        <div className="px-3 pt-3 pb-2 text-[13px] text-[#9ca3af]">
          历史对话
        </div>
        <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
          {listLoading ? (
            <li className="px-3 py-6 text-center text-[13px] text-[#9ca3af]">
              加载列表中…
            </li>
          ) : listError ? (
            <li className="px-3 py-4 text-[13px] text-red-600">
              <span className="block">{listError}</span>
              <button
                type="button"
                onClick={() => void loadConversations()}
                className="mt-2 text-[13px] font-medium text-[#4f46e5] hover:underline"
              >
                重试
              </button>
            </li>
          ) : conversations.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] text-[#9ca3af]">
              暂无历史对话
            </li>
          ) : (
            conversations.map((c) => {
              const selected = activeConversationId === c.id;
              const editing = editingSidebarId === c.id;
              return (
                <li key={c.id} className="group relative">
                  {editing ? (
                    <form
                      className="flex flex-col gap-2 rounded-xl border border-[#e5e7eb] bg-white px-2.5 py-2 shadow-sm"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const t = editSidebarTitleDraft.trim();
                        if (!t) return;
                        void (async () => {
                          const ok = await patchConversation(c.id, {
                            title: t,
                          });
                          if (ok) setEditingSidebarId(null);
                        })();
                      }}
                    >
                      <input
                        value={editSidebarTitleDraft}
                        onChange={(e) =>
                          setEditSidebarTitleDraft(e.target.value)
                        }
                        className="w-full rounded-lg border border-[#e5e7eb] px-2 py-1.5 text-[13px] text-[#111827] outline-none focus:border-[#4f46e5]"
                        autoFocus
                        maxLength={512}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-[12px] text-[#6b7280] hover:bg-[#f3f4f6]"
                          onClick={() => setEditingSidebarId(null)}
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          className="rounded-lg bg-[#4f46e5] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#4338ca]"
                        >
                          保存
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      className={[
                        "group relative flex items-center gap-0.5 rounded-lg transition-colors",
                        selected ? "bg-[#ececee]" : "hover:bg-black/[0.04]",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSidebarId(null);
                          setPreferEmptySession(false);
                          setStaleActionKeys(new Set());
                          setStreamThinking("");
                          setStreamAnswerPreview("");
                          setStreamBlocks([]);
                          setActiveConversationId(c.id);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#e8e8ea] bg-white text-[#a1a1aa]">
                          {c.pinned ? (
                            <IconPin
                              active
                              className="h-3.5 w-3.5 text-amber-500"
                            />
                          ) : (
                            <IconChat />
                          )}
                        </span>
                        <span
                          className="min-w-0 flex-1 truncate text-[14px] text-[#374151]"
                          title={
                            c.title !== shortConversationTitle(c.title)
                              ? c.title
                              : undefined
                          }
                        >
                          {shortConversationTitle(c.title)}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5 pr-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label={c.pinned ? "取消置顶" : "置顶"}
                          title={c.pinned ? "取消置顶" : "置顶"}
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            void togglePinOptimistic(c.id);
                          }}
                          className={[
                            "flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/[0.06]",
                            c.pinned
                              ? "text-amber-500"
                              : "text-[#9ca3af] hover:text-amber-500",
                          ].join(" ")}
                        >
                          <IconPin active={c.pinned} />
                        </button>
                        <button
                          type="button"
                          aria-label="修改标题"
                          title="修改标题"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            setEditingSidebarId(c.id);
                            setEditSidebarTitleDraft(c.title);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[#9ca3af] hover:bg-black/[0.06] hover:text-[#4f46e5] pt-3"
                        >
                          <IconEditTitle />
                        </button>
                        <button
                          type="button"
                          aria-label="删除对话"
                          title="删除对话"
                          onClick={(ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            void deleteConversationOptimistic(c.id, c.title);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[#9ca3af] hover:bg-red-50 hover:text-red-600"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>

        <div className="mt-auto border-t border-[#eceeef] p-3">
          <Link
            href="/corpus"
            className="mb-2 block rounded-lg px-2 py-1.5 text-center text-[12px] font-medium text-[#4f46e5] hover:bg-[#eef2ff]"
          >
            语料导入
          </Link>
          <Link
            href="/me"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-[#6b7280] transition-colors hover:bg-black/[0.04] hover:text-[#374151]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e5e7eb] text-xs font-semibold text-[#374151]">
              {(viewer?.displayName ?? "家").slice(0, 1)}
            </div>
            <span className="min-w-0 flex-1 truncate">
              <span className="block truncate font-medium text-[#374151]">
                {viewer?.displayName ?? "家庭成员"}
              </span>
              <span className="block truncate text-[11px] text-[#9ca3af]">
                {(viewer?.isAdmin ? "管理员 · " : "") +
                  (viewer?.canManageMembers ? "成员管理 · " : "")}
                {viewer?.username ? `@${viewer.username}` : "@local"}
              </span>
            </span>
          </Link>
          {viewer?.canManageMembers ? (
            <Link
              href="/admin/users"
              className="mt-2 block rounded-lg px-2 py-1.5 text-center text-[12px] font-medium text-[#4f46e5] hover:bg-[#eef2ff]"
            >
              审核成员
            </Link>
          ) : null}
        </div>
      </aside>
  );
};
