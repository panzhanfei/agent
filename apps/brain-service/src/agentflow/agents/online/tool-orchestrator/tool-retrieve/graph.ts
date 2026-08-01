/**
 * tool 单槽子图壳（阶段 3）：单节点 → runToolSlotWorker + 一层预算。
 * 父图 addNode("toolRetrieve", getCompiledToolSlotGraph())；阶段 4 可扩 L1。
 */
import { END, START, StateGraph } from "@langchain/langgraph";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { emitBudgetedSlotPatch } from "@/agentflow/agents/online/plan-fanout/slot-budget";
import {
  PipelineGraphAnnotation,
  type PipelineGraphState,
} from "@/agentflow/pipeline/graph/state";
import { runToolSlotWorker } from "./worker";

const runToolSlot = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("ToolOrchestrator", "进入", {
    via: "toolRetrieve",
    slotId: state.activeSlotId,
    shell: "tool-slot",
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

const buildToolSlotGraph = () =>
  new StateGraph(PipelineGraphAnnotation)
    .addNode("runToolSlot", runToolSlot)
    .addEdge(START, "runToolSlot")
    .addEdge("runToolSlot", END);

type ToolSlotCompiled = ReturnType<
  ReturnType<typeof buildToolSlotGraph>["compile"]
>;

let compiledToolSlot: ToolSlotCompiled | null = null;

export const getCompiledToolSlotGraph = (): ToolSlotCompiled => {
  if (!compiledToolSlot) {
    compiledToolSlot = buildToolSlotGraph().compile({ name: "tool-slot" });
  }
  return compiledToolSlot;
};

/** 兼容直接 invoke；父图优先挂编译子图 */
export const runToolRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  return getCompiledToolSlotGraph().invoke(state);
};
