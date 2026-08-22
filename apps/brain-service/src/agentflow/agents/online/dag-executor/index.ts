/**
 * DagExecutor：按 executionPlan 拓扑执行（deps 分波）。
 * 图节点 `runPlanDagNode` 见文件底部。单节点怎么跑走 tool-orchestrator。
 */

export type { ExecuteDagPlanOptions } from "./interface";
export { executeDagPlan } from "./execute-plan";
export { runDagExecutorNode } from "./run";

import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { PlanDagPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { runDagExecutorNode } from "./run";

/** LangGraph `planDag`：写入 fanOutDagPatch */
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
