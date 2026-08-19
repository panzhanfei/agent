/**
 * 全局 B：一次 LLM JSON；解析失败 → 空 repairs（不硬编码补救）。
 */
import { logAgentIn, logAgentOut } from "@fambrain/brain-shared/agent-log";
import { completeChat } from "@fambrain/brain-shared/chat";
import { recordCompleteChatUsage } from "@fambrain/brain-shared/pipeline-run-context";
import { parseJsonObject } from "@/agentflow/utils";
import type { PlanSlotWorkerPatch } from "../interface";
import type { ExecutionPlanNode, PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/interface";
import { GLOBAL_REBATCH_SYSTEM_PROMPT } from "./prompt";
import { parseGlobalRebatchPlan } from "./schema";
import type { GlobalRebatchRepair } from "./interface";

export type GlobalRebatchLlmInput = {
  userQuestion: string;
  candidateSlots: Array<{
    slotId: string;
    label: string;
    executor?: string;
    searchQuery: string;
    toolId?: string | null;
    coverage?: string;
    error?: string | null;
    toolOk?: boolean | null;
    status?: string;
    reason?: string | null;
    attempts: number;
  }>;
  candidateDagNodes: Array<{
    nodeId: string;
    label: string;
    toolId: string;
    searchQuery?: string;
    webQuery?: string;
    ok?: boolean;
    insufficientEvidence?: boolean;
    skipped?: boolean;
  }>;
};

const buildHumanPayload = (input: GlobalRebatchLlmInput): string =>
  JSON.stringify(
    {
      userQuestion: input.userQuestion,
      candidateSlots: input.candidateSlots,
      candidateDagNodes: input.candidateDagNodes,
    },
    null,
    2
  );

export const completeGlobalRebatchPlan = async (
  input: GlobalRebatchLlmInput
): Promise<GlobalRebatchRepair[]> => {
  if (
    input.candidateSlots.length === 0 &&
    input.candidateDagNodes.length === 0
  ) {
    return [];
  }

  logAgentIn("GlobalRebatch", "进入", {
    slotCandidates: input.candidateSlots.length,
    dagCandidates: input.candidateDagNodes.length,
  });

  try {
    const payload = buildHumanPayload(input);
    const resultChat = await completeChat({
      messages: [
        { role: "system", content: GLOBAL_REBATCH_SYSTEM_PROMPT },
        { role: "user", content: payload },
      ],
      jsonMode: true,
      thinking: "disabled",
    });
    recordCompleteChatUsage(resultChat.usage, {
      promptText: `${GLOBAL_REBATCH_SYSTEM_PROMPT}\n${payload}`,
      completionText: resultChat.text,
      node: "global_rebatch",
    });
    const obj = parseJsonObject(resultChat.text);
    if (!obj) {
      logAgentOut("GlobalRebatch", "出去", { repairCount: 0, parse: "null" });
      return [];
    }
    const { repairs } = parseGlobalRebatchPlan(obj);
    logAgentOut("GlobalRebatch", "出去", {
      repairCount: repairs.length,
      actions: repairs.map((r) => ({
        targetId: r.targetId,
        kind: r.kind,
        action: r.action,
      })),
    });
    return repairs;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "global_rebatch_llm_failed";
    logAgentOut("GlobalRebatch", "失败", { error: msg });
    return [];
  }
};

/** 从工人补丁拼 LLM 候选行 */
export const buildSlotCandidateRows = (
  slotIds: readonly string[],
  patches: readonly PlanSlotWorkerPatch[],
  slots: ReadonlyArray<{
    id: string | number;
    label: string;
    searchQuery: string;
    executor?: string;
    toolId?: string | null;
  }>,
  slotRuntimeById: Record<
    string,
    { status: string; reason?: string | null; attempts: number }
  >
): GlobalRebatchLlmInput["candidateSlots"] => {
  const patchById = new Map(patches.map((p) => [String(p.slotId), p]));
  const slotById = new Map(slots.map((s) => [String(s.id), s]));
  return slotIds.map((id) => {
    const slot = slotById.get(id);
    const patch = patchById.get(id);
    const runtime = slotRuntimeById[id];
    return {
      slotId: id,
      label: slot?.label ?? id,
      executor: slot?.executor,
      searchQuery: slot?.searchQuery ?? "",
      toolId: slot?.toolId ?? null,
      coverage: patch?.sub.coverage,
      error: patch?.error ?? null,
      toolOk: patch?.toolResult ? patch.toolResult.ok : null,
      status: runtime?.status,
      reason: runtime?.reason ?? null,
      attempts: runtime?.attempts ?? 0,
    };
  });
};

export const buildDagCandidateRows = (
  nodeIds: readonly string[],
  plan: readonly ExecutionPlanNode[],
  results: PipelineToolResults | null | undefined
): GlobalRebatchLlmInput["candidateDagNodes"] => {
  const byId = new Map(plan.map((n) => [n.id, n]));
  return nodeIds.map((id) => {
    const node = byId.get(id);
    const r = results?.[id];
    return {
      nodeId: id,
      label: node?.label ?? id,
      toolId: node?.toolId ?? "search_web",
      searchQuery: node?.searchQuery,
      webQuery: node?.webQuery,
      ok: r?.ok,
      insufficientEvidence: r?.insufficientEvidence,
      skipped: r?.skipped,
    };
  });
};
