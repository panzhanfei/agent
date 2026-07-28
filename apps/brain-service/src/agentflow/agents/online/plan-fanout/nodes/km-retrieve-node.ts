/**
 * kmRetrieve：每槽 Send 工人（executor ≠ list_corpus）；retrieve + FC + 局部重检。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { runKmSlotWorker } from "../slot-worker";

export const runKmRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("KnowledgeManager", "进入", {
    via: "kmRetrieve",
    slotId: state.activeSlotId,
  });

  const patch = await runKmSlotWorker(state);

  logAgentOut("KnowledgeManager", "出去", {
    via: "kmRetrieve",
    slotId: patch.slotId,
    hitCount: patch.sub.hits.length,
    coverage: patch.sub.coverage,
    fcPassed: patch.stepResult.fc?.passed ?? null,
    retried: Boolean(patch.retried),
  });

  return { fanOutSlotPatches: [patch] };
};
