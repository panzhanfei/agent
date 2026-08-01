/**
 * KM 单槽子图壳（阶段 3）：单节点 → runKmSlotWorker + 一层预算。
 * 父图 addNode("kmRetrieve", getCompiledKmSlotGraph())；阶段 4 在此扩 L1。
 */
import { END, START, StateGraph } from "@langchain/langgraph";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { emitBudgetedSlotPatch } from "@/agentflow/agents/online/plan-fanout/slot-budget";
import {
  PipelineGraphAnnotation,
  type PipelineGraphState,
} from "@/agentflow/pipeline/graph/state";
import { runKmSlotWorker } from "./worker";

/** 子图内唯一执行节点（预算只包这一层） */
const runKmSlot = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("KnowledgeManager", "进入", {
    via: "kmRetrieve",
    slotId: state.activeSlotId,
    shell: "km-slot",
  });

  const out = await emitBudgetedSlotPatch(state, "km", () =>
    runKmSlotWorker(state)
  );
  const patch = out.fanOutSlotPatches?.[0];

  logAgentOut("KnowledgeManager", "出去", {
    via: "kmRetrieve",
    slotId: patch?.slotId ?? state.activeSlotId,
    hitCount: patch?.sub.hits.length ?? 0,
    coverage: patch?.sub.coverage ?? null,
    fcPassed: patch?.stepResult.fc?.passed ?? null,
    retried: Boolean(patch?.retried),
    slotStatus: patch?.slotRuntime?.status ?? null,
    slotReason: patch?.slotRuntime?.reason ?? null,
  });

  return out;
};

const buildKmSlotGraph = () =>
  new StateGraph(PipelineGraphAnnotation)
    .addNode("runKmSlot", runKmSlot)
    .addEdge(START, "runKmSlot")
    .addEdge("runKmSlot", END);

type KmSlotCompiled = ReturnType<ReturnType<typeof buildKmSlotGraph>["compile"]>;

let compiledKmSlot: KmSlotCompiled | null = null;

export const getCompiledKmSlotGraph = (): KmSlotCompiled => {
  if (!compiledKmSlot) {
    compiledKmSlot = buildKmSlotGraph().compile({ name: "km-slot" });
  }
  return compiledKmSlot;
};

/** 兼容直接 invoke；父图优先挂编译子图 */
export const runKmRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  return getCompiledKmSlotGraph().invoke(state);
};
