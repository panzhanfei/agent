/**
 * KM 检索节点：复合路径下跑全部 compositeSlots（km + list）。
 * 图并行路径优先用 retrieveKmCompositeSlots / retrieveListCompositeSlots；
 * 本节点保留给纯串行调用与 FC 重试。
 */
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import {
  mergeKmAndListRetrieveBundles,
  retrieveKmCompositeSlots,
  retrieveListCompositeSlots,
} from "./retrieve-slot-bundles";

export const runRetrievalNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  if (!decision) {
    return { error: "缺少入口路由决策" };
  }
  const fromRetry = !state.checkerPassed && state.retryCount < 1;
  const slots = decision.compositeSlots ?? [];
  if (slots.length === 0) {
    return { error: "检索缺少槽位定义（compositeSlots 为空）" };
  }

  const [km, list] = await Promise.all([
    retrieveKmCompositeSlots(state),
    retrieveListCompositeSlots(state),
  ]);

  if (km.error) {
    return {
      error: km.error,
      retryCount: fromRetry ? state.retryCount + 1 : state.retryCount,
    };
  }
  if (list.error) {
    return {
      error: list.error,
      retryCount: fromRetry ? state.retryCount + 1 : state.retryCount,
    };
  }

  const merged = mergeKmAndListRetrieveBundles(slots, km, list);
  return {
    ...merged,
    retryCount: fromRetry ? state.retryCount + 1 : state.retryCount,
  };
};
