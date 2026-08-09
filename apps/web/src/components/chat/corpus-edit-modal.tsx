"use client";

import { useEffect, useState } from "react";
import type { AssistantMessageBlock } from "@fambrain/brain-types";

type Props = {
  targetPath: string;
  conversationId: string | null;
  onClose: () => void;
  onProposed: (input: {
    answer: string;
    blocks: AssistantMessageBlock[];
    staleGroupKey: string | null;
  }) => void;
};

type EditMode = "plain" | "markdown";

/** 方案 C：正文 / Markdown 双模式编辑器 */
export const CorpusEditModal = ({
  targetPath,
  conversationId,
  onClose,
  onProposed,
}: Props) => {
  const [mode, setMode] = useState<EditMode>("plain");
  const [content, setContent] = useState("");
  const [repoPath, setRepoPath] = useState(targetPath);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/hitl/corpus-edit/content?targetPath=${encodeURIComponent(targetPath)}`,
          { credentials: "same-origin" }
        );
        const data = (await res.json()) as {
          ok?: boolean;
          content?: string;
          repoPath?: string;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "加载文件失败");
        }
        if (!cancelled) {
          setContent(data.content ?? "");
          setRepoPath(data.repoPath ?? targetPath);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetPath]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hitl/corpus-edit/propose", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPath: repoPath,
          operation: "update",
          afterContent: content,
          conversationId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        answer?: string;
        blocks?: AssistantMessageBlock[];
        error?: string;
        proposal?: { proposalId?: string };
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "提交提案失败");
      }
      onProposed({
        answer: data.answer ?? "已生成更新提案，请确认。",
        blocks: data.blocks ?? [],
        staleGroupKey: `path:${repoPath}`,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="border-b border-[#e5e7eb] px-4 py-3">
          <div className="text-[15px] font-semibold text-[#111827]">
            编辑语料文件
          </div>
          <div className="mt-1 break-all text-[12px] text-[#6b7280]">
            {repoPath}
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-[#f3f4f6] px-4 py-2">
          <button
            type="button"
            onClick={() => setMode("plain")}
            className={`rounded-md px-3 py-1 text-[12px] font-medium ${
              mode === "plain"
                ? "bg-[#eef2ff] text-[#4338ca]"
                : "text-[#6b7280] hover:bg-[#f9fafb]"
            }`}
          >
            正文
          </button>
          <button
            type="button"
            onClick={() => setMode("markdown")}
            className={`rounded-md px-3 py-1 text-[12px] font-medium ${
              mode === "markdown"
                ? "bg-[#eef2ff] text-[#4338ca]"
                : "text-[#6b7280] hover:bg-[#f9fafb]"
            }`}
          >
            Markdown
          </button>
          <span className="ml-auto text-[11px] text-[#9ca3af]">
            {mode === "plain"
              ? "按纯文本编辑，不必写 Markdown 语法"
              : "按 Markdown 编辑；保存内容即为将写入正文"}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading ? (
            <p className="text-[13px] text-[#6b7280]">加载中…</p>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={mode === "plain"}
              className={`h-[50vh] w-full resize-y rounded-lg border border-[#e5e7eb] p-3 text-[13px] text-[#111827] outline-none focus:border-[#a5b4fc] ${
                mode === "markdown" ? "font-mono" : ""
              }`}
              placeholder={
                mode === "plain" ? "在此输入正文…" : "# 标题\n\n正文…"
              }
            />
          )}
          {error ? (
            <p className="mt-2 text-[12px] text-red-600">{error}</p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#e5e7eb] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[13px] text-[#4b5563] hover:bg-[#f3f4f6]"
            disabled={saving}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={loading || saving}
            className="rounded-lg bg-[#4338ca] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#3730a3] disabled:opacity-50"
          >
            {saving ? "提交中…" : "提交修改（待确认）"}
          </button>
        </div>
      </div>
    </div>
  );
};
