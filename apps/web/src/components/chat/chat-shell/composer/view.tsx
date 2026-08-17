"use client";

import { IconMic, IconPlus } from "../icons";
import type { ChatComposerProps } from "./interface";

export const ChatComposer = ({ model }: ChatComposerProps) => {
  const {
    sendError,
    uploadNotice,
    speech,
    draft,
    setDraft,
    speechDraftBaseRef,
    setSendError,
    isComposingRef,
    sendBusy,
    pendingAttachments,
    sendMessage,
    uploadBusy,
    removePendingAttachment,
    attachInputRef,
    handleAttachPick,
    streamingTurnId,
    pauseActiveTurn,
  } = model;

  return (
          <div className="shrink-0 border-t border-[#f3f4f6] bg-white px-4 pb-6 pt-4 sm:px-8">
            <div className="mx-auto max-w-3xl rounded-[22px] border border-[#e8e8e8] bg-[#fafafa] shadow-sm">
              {sendError ? (
                <div className="border-b border-red-100 px-4 py-2 text-[13px] text-red-600">
                  {sendError}
                </div>
              ) : null}
              {uploadNotice ? (
                <div
                  className={[
                    "border-b px-4 py-2 text-[13px]",
                    uploadNotice.includes("失败") ||
                    uploadNotice.startsWith("请")
                      ? "border-red-100 text-red-600"
                      : "border-emerald-100 text-emerald-800",
                  ].join(" ")}
                >
                  {uploadNotice}
                </div>
              ) : null}
              {speech.error ? (
                <div className="border-b border-amber-100 px-4 py-2 text-[13px] text-amber-800">
                  {speech.error}
                </div>
              ) : null}
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  speechDraftBaseRef.current = e.target.value;
                  if (sendError) setSendError(null);
                }}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onCompositionEnd={() => {
                  isComposingRef.current = false;
                }}
                disabled={sendBusy}
                placeholder={
                  sendBusy
                    ? "生成回复中…"
                    : speech.listening
                      ? "正在听你说…（说完点红色麦克风停止）"
                      : pendingAttachments.length > 0
                        ? "写明要对附件做什么：抽取原文 / 总结 / 翻译 / 入库（须有文字才能发送）"
                        : "发消息或输入 '/' 选择技能（Enter 发送，Shift+Enter 换行；中文选字时 Enter 不会发送）"
                }
                rows={3}
                className="block w-full resize-none bg-transparent px-4 pb-2 pt-3 text-[15px] text-[#111827] outline-none placeholder:text-[#a1a1aa] disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey) return;
                  if (e.nativeEvent.isComposing || isComposingRef.current)
                    return;
                  e.preventDefault();
                  void sendMessage();
                }}
              />
              {pendingAttachments.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5 border-t border-black/[0.04] px-3 pt-2">
                  {pendingAttachments.map((a) => (
                    <li
                      key={a.id}
                      className="flex max-w-full items-center gap-1 rounded-full bg-[#eef2ff] px-2.5 py-1 text-[12px] text-[#3730a3]"
                    >
                      <span className="truncate" title={a.name}>
                        {a.name}
                      </span>
                      <button
                        type="button"
                        disabled={sendBusy || uploadBusy}
                        onClick={() => removePendingAttachment(a.id)}
                        className="shrink-0 rounded-full px-1 text-[#6366f1] hover:bg-white/60 disabled:opacity-40"
                        aria-label={`移除 ${a.name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex items-center gap-2 border-t border-black/[0.04] px-3 py-2">
                <input
                  ref={attachInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff,.tif"
                  onChange={(e) => {
                    handleAttachPick(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={uploadBusy || sendBusy}
                  onClick={() => attachInputRef.current?.click()}
                  className="rounded-lg p-2 text-[#9ca3af] hover:bg-black/[0.04] hover:text-[#374151] disabled:opacity-40"
                  aria-label="添加附件"
                  title="添加附件（发送后按你的说明抽取/总结/翻译/入库；语料页仍可直接入库）"
                >
                  <IconPlus className="h-5 w-5" />
                </button>
                <div className="flex-1" />
                {streamingTurnId ? (
                  <button
                    type="button"
                    onClick={() => void pauseActiveTurn()}
                    className="rounded-full bg-[#dc2626] px-4 py-1.5 text-[13px] font-medium text-white"
                  >
                    停止
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={
                    !draft.trim() ||
                    uploadBusy ||
                    (sendBusy && !streamingTurnId)
                  }
                  className="rounded-full bg-[#4f46e5] px-4 py-1.5 text-[13px] font-medium text-white disabled:opacity-40"
                  title={
                    !draft.trim()
                      ? "请先写明要对附件或问题做什么"
                      : undefined
                  }
                >
                  {uploadBusy
                    ? "抽取中…"
                    : sendBusy && !streamingTurnId
                      ? "发送中…"
                      : "发送"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!speech.listening) speechDraftBaseRef.current = draft;
                    speech.toggle();
                  }}
                  disabled={sendBusy || !speech.supported}
                  title={
                    speech.supported
                      ? speech.listening
                        ? "点击停止语音输入"
                        : "语音输入（浏览器识别）"
                      : "当前浏览器不支持语音输入"
                  }
                  className={[
                    "rounded-lg p-2 disabled:opacity-40",
                    speech.listening
                      ? "bg-red-50 text-red-600 animate-pulse"
                      : "text-[#9ca3af] hover:bg-black/[0.04] hover:text-[#374151]",
                  ].join(" ")}
                  aria-label={speech.listening ? "停止语音输入" : "语音输入"}
                  aria-pressed={speech.listening}
                >
                  <IconMic />
                </button>
              </div>
            </div>
          </div>
  );
};
