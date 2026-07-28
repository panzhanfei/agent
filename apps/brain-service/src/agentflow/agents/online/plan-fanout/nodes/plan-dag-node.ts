/**
 * planDag：hybrid_multi_source DAG 工人；写入 fanOutDagPatch。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { runDagExecutorNode } from "@/agentflow/agents/online/tool-orchestrator";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PlanDagPatch } from "../interface";

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
