import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import {
  resolvePostRetrievalToolRuns,
  runExecutionPlanNode,
} from "../execute";
import type { PipelineToolResults } from "../interface";

export const runToolOrchestratorNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  // 纯 hybrid（无检索槽）时工具已在 DAG 内跑完；有槽时仍跑 post-retrieval tools
  if ((decision?.compositeSlots?.length ?? 0) === 0) {
    logAgentOut("ToolOrchestrator", "跳过", {
      reason: "no_composite_slots",
    });
    return {};
  }

  const runs = resolvePostRetrievalToolRuns(state);
  if (runs.length === 0) return {};

  const results: PipelineToolResults = { ...(state.toolResults ?? {}) };
  for (const run of runs) {
    results[run.key] = await runExecutionPlanNode(run.node, {
      state,
      prior: results,
    });
  }

  logAgentOut("ToolOrchestrator", "完成", {
    keys: Object.keys(results),
  });
  return { toolResults: results };
};
