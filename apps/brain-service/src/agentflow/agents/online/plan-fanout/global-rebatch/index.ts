/**
 * Join 后全局协调 B：结构候选 → 一次 LLM → 结构化补丁 → 再批 Send。
 */
import { Send } from "@langchain/langgraph";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PlanSlotWorkerPatch, PlanSlotsPatch } from "../interface";
import { applyGlobalRebatchRepairs } from "./apply";
import {
  buildDagCandidateRows,
  buildSlotCandidateRows,
  completeGlobalRebatchPlan,
} from "./llm";
import {
  selectSalvageableDagNodeIds,
  selectSalvageableSlotIds,
} from "./select";
import type { GlobalRebatchPlanResult } from "./interface";

export type { GlobalRebatchAction, GlobalRebatchRepair, GlobalRebatchPlanResult } from "./interface";
export {
  isSlotStructurallySalvageable,
  selectSalvageableSlotIds,
  selectSalvageableDagNodeIds,
} from "./select";
export { applyGlobalRebatchRepairs } from "./apply";
export { parseGlobalRebatchPlan } from "./schema";

const sendTargetForExecutor = (
  executor: string | undefined
):
  | "kmRetrieve"
  | "listRetrieve"
  | "memRetrieve"
  | "toolRetrieve"
  | "summarizeSlot" => {
  switch (executor) {
    case "list_corpus":
      return "listRetrieve";
    case "mem_recall":
      return "memRetrieve";
    case "tool_run":
      return "toolRetrieve";
    case "summarize_slot":
      return "summarizeSlot";
    default:
      return "kmRetrieve";
  }
};

/** 跑全局 B；无可救候选或 LLM 全 abandon → rebatch 空 */
export const runGlobalRebatchPlanning = async (input: {
  decision: RoutedIntakeDecision;
  userQuestion: string;
  patches: readonly PlanSlotWorkerPatch[];
  slotRuntimeById: PipelineGraphState["slotRuntimeById"];
  policy: PipelineGraphState["retryPolicy"];
  dagToolResults?: PlanSlotsPatch["toolResults"] | null;
}): Promise<GlobalRebatchPlanResult | null> => {
  const slots = input.decision.compositeSlots ?? [];
  const slotIds = selectSalvageableSlotIds({
    slotIds: slots.map((s) => String(s.id)),
    patches: input.patches,
    slotRuntimeById: input.slotRuntimeById,
    policy: input.policy,
  });
  const dagPlan = input.decision.executionPlan ?? [];
  const dagNodeIds = selectSalvageableDagNodeIds(
    dagPlan,
    input.dagToolResults ?? null
  );

  if (slotIds.length === 0 && dagNodeIds.length === 0) {
    return null;
  }

  const repairs = await completeGlobalRebatchPlan({
    userQuestion: input.userQuestion,
    candidateSlots: buildSlotCandidateRows(
      slotIds,
      input.patches,
      slots,
      input.slotRuntimeById
    ),
    candidateDagNodes: buildDagCandidateRows(
      dagNodeIds,
      dagPlan,
      input.dagToolResults ?? null
    ),
  });

  if (repairs.length === 0) {
    return null;
  }

  const applied = applyGlobalRebatchRepairs({
    decision: input.decision,
    repairs,
    allowedSlotIds: new Set(slotIds),
    allowedDagNodeIds: new Set(dagNodeIds),
  });

  if (applied.rebatchSlotIds.length === 0 && !applied.rebatchDag) {
    return null;
  }

  logAgentOut("GlobalRebatch", "应用补丁", {
    rebatchSlotIds: applied.rebatchSlotIds,
    rebatchDag: applied.rebatchDag,
  });

  return {
    decision: applied.decision,
    rebatchSlotIds: applied.rebatchSlotIds,
    rebatchDag: applied.rebatchDag,
    repairs,
  };
};

/** 仅再批指定槽（+ 可选 DAG）；不重发 side-effect / 成功槽 */
export const fanOutRebatchWorkers = (state: PipelineGraphState): Send[] => {
  const decision = state.decision;
  const sends: Send[] = [];
  if (!decision) return sends;

  const idSet = new Set(state.pendingGlobalRebatchSlotIds ?? []);
  for (const slot of decision.compositeSlots ?? []) {
    const id = String(slot.id);
    if (!idSet.has(id)) continue;
    const payload = { ...state, activeSlotId: id };
    sends.push(new Send(sendTargetForExecutor(slot.executor), payload));
  }
  if (state.pendingGlobalRebatchDag) {
    sends.push(new Send("planDag", state));
  }
  return sends;
};

/** Join 后：有 pending 再批 → Send；否则进 planSlotPost */
export const routeAfterPlanSlotJoin = (
  state: PipelineGraphState
): Send[] | "planSlotPost" => {
  const ids = state.pendingGlobalRebatchSlotIds ?? [];
  const dag = Boolean(state.pendingGlobalRebatchDag);
  if (ids.length === 0 && !dag) return "planSlotPost";
  const sends = fanOutRebatchWorkers(state);
  if (sends.length === 0) return "planSlotPost";
  return sends;
};
