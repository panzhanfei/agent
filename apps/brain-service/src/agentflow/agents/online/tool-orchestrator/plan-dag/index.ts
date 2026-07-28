/**
 * planDag：hybrid_multi_source DAG 工人；写入 fanOutDagPatch。
 * 在 planFanOut Send 链内调用 dag-executor，结果适配 plan-fanout 补丁通道。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { PlanDagPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { runDagExecutorNode } from "../dag-executor";

export const runPlanDagNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("PlanDag", "进入", {
    executionPlanCount: state.decision?.executionPlan?.length ?? 0,
  });

  const dagPatch = await runDagExecutorNode(state);
  if (dagPatch.error) {
    return {
      fanOutDagPatch: {
        error: dagPatch.error,
        hits: [],
        coverage: "none",
      },
    };
  }

  const patch: PlanDagPatch = {
    hits: dagPatch.hits ?? [],
    coverage: dagPatch.coverage ?? "none",
    notes: dagPatch.notes ?? null,
    error: dagPatch.error ?? null,
    toolResults: dagPatch.toolResults ?? null,
  };

  logAgentOut("PlanDag", "完成", {
    hitCount: patch.hits?.length ?? 0,
    toolKeys: Object.keys(patch.toolResults ?? {}),
  });

  return { fanOutDagPatch: patch };
};
