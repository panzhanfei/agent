/**
 * listRetrieve：每槽 Send 工人（executor=list_corpus）；retrieve + FC。
 * 纯 list 短路仍走图节点 listRetriever（不经本工人）。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { runListSlotWorker } from "../slot-worker";

export const runListRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("ListRetriever", "进入", {
    via: "listRetrieve",
    slotId: state.activeSlotId,
  });

  const patch = await runListSlotWorker(state);

  logAgentOut("ListRetriever", "出去", {
    via: "listRetrieve",
    slotId: patch.slotId,
    hitCount: patch.sub.hits.length,
    coverage: patch.sub.coverage,
    fcPassed: patch.stepResult.fc?.passed ?? null,
  });

  return { fanOutSlotPatches: [patch] };
};
