"use client";

import type { PipelineStepName } from "@fambrain/brain-types";
import {
  formatStepTokenLabel,
  formatTokenByNodeEntries,
  formatTokenTotalShort,
} from "@/lib/chat/conversation-logs";
import { useState } from "react";
import { formatDuration } from "./helpers";
import type { MessageTiming } from "./interface";

export const STEP_TIMING_LABELS: Record<PipelineStepName, string> = {
  prepare_turn_start: "准备上下文",
  repeat_question_guard: "同问短路",
  prepare_pipeline_memory: "加载记忆",
  repeat_respond_early: "复用历史答",
  intake: "理解问题",
  user_fact: "读取记忆",
  retrieval: "检索知识库",
  km_retrieve: "知识检索",
  list_retrieve: "列举检索",
  vault_workspace: "原文库",
  vault_save_gate: "确认入库",
  plan_cache_resolve: "解析缓存",
  plan_slot_join: "槽位汇合",
  plan_slot_post: "检索后工具",
  plan_dag: "多源汇合",
  plan_merge: "合并结果",
  global_rebatch: "全局重批",
  plan_executor: "执行计划",
  fact_checker: "核查证据",
  content_summarizer: "生成摘要",
  content_organizer: "整理证据",
  analyst: "生成回答",
  persist_turn_end: "写入记忆",
};

/** 流式 step=running 时展示在「思考过程」里的短文案 */
export const STEP_RUNNING_LABELS: Partial<Record<string, string>> = {
  prepare_turn_start: "准备上下文…",
  repeat_question_guard: "同问短路…",
  prepare_pipeline_memory: "加载记忆…",
  repeat_respond_early: "复用历史答…",
  intake: "理解问题…",
  user_fact: "读取记忆…",
  retrieval: "检索知识库…",
  km_retrieve: "知识检索…",
  list_retrieve: "列举检索…",
  vault_workspace: "原文库…",
  vault_save_gate: "确认是否入库…",
  plan_cache_resolve: "解析缓存…",
  plan_slot_join: "槽位汇合…",
  plan_slot_post: "检索后工具…",
  plan_dag: "多源汇合…",
  plan_merge: "合并结果…",
  global_rebatch: "全局重批…",
  plan_executor: "执行计划…",
  fact_checker: "核查证据…",
  content_summarizer: "生成摘要…",
  content_organizer: "整理证据…",
  analyst: "生成回答…",
  persist_turn_end: "写入记忆…",
};

export const MessageTimingLine = ({ timing }: { timing: MessageTiming }) => {
  const [expanded, setExpanded] = useState(false);
  const nodeEntries = (
    Object.entries(timing.nodes ?? {}) as [PipelineStepName, number][]
  ).filter(([, ms]) => ms > 0);
  const tokenNodes = formatTokenByNodeEntries(timing);
  const tokenLine = formatTokenTotalShort(timing);
  const tokens = timing.tokens;
  /** 耗时步 + 仅有 token、未进 nodes 的 LLM 步 */
  const stepNames = (() => {
    const seen = new Set<string>();
    const names: string[] = [];
    for (const [name] of nodeEntries) {
      seen.add(name);
      names.push(name);
    }
    for (const e of tokenNodes) {
      if (!seen.has(e.name)) names.push(e.name);
    }
    return names;
  })();
  const canExpand = stepNames.length > 0;

  return (
    <div className="mt-1.5 text-[11px] leading-snug text-[#9ca3af]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-left hover:text-[#6b7280]"
      >
        用时 {formatDuration(timing.totalMs)}
        {timing.ttftMs != null
          ? ` · 首字 ${formatDuration(timing.ttftMs)}`
          : ""}
        {tokenLine ? ` · ${tokenLine}` : ""}
        {timing.clientTotalMs != null
          ? ` · 全链路 ${formatDuration(timing.clientTotalMs)}`
          : ""}
        {canExpand ? (expanded ? " ▴" : " ▾") : ""}
      </button>
      {expanded && canExpand ? (
        <ul className="mt-1 space-y-0.5 pl-2">
          {stepNames.map((name) => {
            const ms = timing.nodes?.[name as PipelineStepName];
            const tokLabel = formatStepTokenLabel(
              timing.tokens?.byNode?.[name as PipelineStepName]
            );
            return (
              <li key={name}>
                {STEP_TIMING_LABELS[name as PipelineStepName] ?? name}
                {ms != null && ms > 0 ? ` ${formatDuration(ms)}` : ""}
                {tokLabel ? ` · ${tokLabel}` : ""}
              </li>
            );
          })}
          {tokens && tokens.totalTokens > 0 ? (
            <li className="pt-0.5 font-medium text-[#6b7280]">
              合计 {tokens.totalTokens.toLocaleString()} tok（入{" "}
              {tokens.promptTokens.toLocaleString()} / 出{" "}
              {tokens.completionTokens.toLocaleString()}）
              {tokens.estimated ? "（估算）" : ""}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
};
