/**
 * listRetrieve：复合路径下仅跑 executor=list_corpus 的槽；写入 fanOutListPatch。
 * 纯 list 短路仍走图节点 listRetriever（不经本工人）。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import {
  mergeCompositeRetrieval,
  retrieveListCompositeSlots,
} from "@/agentflow/agents/online/knowledge-manager";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PlanSlotsPatch } from "../interface";

export const runListRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  if (!decision) {
    return {
      fanOutListPatch: { error: "缺少入口路由决策", hits: [], coverage: "none" },
    };
  }

  logAgentOut("ListRetriever", "进入", {
    via: "listRetrieve",
    slotCount: decision.compositeSlots?.length ?? 0,
  });

  const list = await retrieveListCompositeSlots(state);
  if (list.error) {
    return {
      fanOutListPatch: { error: list.error, hits: [], coverage: "none" },
    };
  }
  if (list.subResults.length === 0) {
    return { fanOutListPatch: null };
  }

  const merged = mergeCompositeRetrieval(list.subResults);
  const enumerationMeta =
    list.subResults.find((s) => s.enumerationMeta)?.enumerationMeta ?? null;

  const patch: PlanSlotsPatch = {
    hits: merged.hits,
    coverage: merged.coverage,
    notes: merged.notes,
    confidenceTier: merged.confidenceTier,
    enumerationMeta,
    compositeSubResults: list.subResults,
    checkerPassed: true,
    retryCount: state.retryCount,
    error: null,
  };

  logAgentOut("ListRetriever", "出去", {
    via: "listRetrieve",
    hitCount: patch.hits?.length ?? 0,
    coverage: patch.coverage,
  });

  return { fanOutListPatch: patch };
};
