/**
 * toolRetrieve：独立工具步（kind=tool / executor=tool_run）。
 * 单槽工人 + 一层预算，与 list/mem 同形。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { emitBudgetedSlotPatch } from "@/agentflow/agents/online/plan-fanout/slot-budget";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { runToolSlotWorker } from "./worker";

export { runToolSlotWorker } from "./worker";

/** LangGraph `toolRetrieve` */
export const runToolRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("ToolOrchestrator", "进入", {
    via: "toolRetrieve",
    slotId: state.activeSlotId,
  });

  const out = await emitBudgetedSlotPatch(state, "tool", () =>
    runToolSlotWorker(state)
  );
  const patch = out.fanOutSlotPatches?.[0];

  logAgentOut("ToolOrchestrator", "出去", {
    via: "toolRetrieve",
    slotId: patch?.slotId ?? state.activeSlotId,
    toolId: patch?.toolResult?.toolId ?? null,
    ok: patch?.toolResult?.ok ?? false,
    slotStatus: patch?.slotRuntime?.status ?? null,
  });

  return out;
};
