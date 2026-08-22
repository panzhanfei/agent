import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import {
  collectRetrieveCorpusHits,
  pickSynthesizeMergeRun,
} from "@/agentflow/tools/local/synthesize";
import { executeDagPlan } from "../execute-plan";

export const runDagExecutorNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const plan = state.decision?.executionPlan;
  if (!plan?.length) {
    return { error: "DAG 路由缺少 executionPlan" };
  }
  try {
    const forceIds = state.pendingGlobalRebatchDagNodeIds ?? [];
    const seed =
      forceIds.length > 0 ? state.fanOutDagPatch?.toolResults ?? null : null;
    const raw = await executeDagPlan(plan, state, {
      seedToolResults: seed,
      forceRerunIds: forceIds,
    });
    const synthesis = pickSynthesizeMergeRun(raw);
    const toolResults = {
      ...raw,
      ...(synthesis ? { synthesis } : {}),
    };
    const hits = collectRetrieveCorpusHits(toolResults);
    return {
      hits,
      coverage:
        hits.length > 0
          ? synthesis?.insufficientEvidence
            ? "partial"
            : "sufficient"
          : "none",
      notes: synthesis?.ok
        ? "DAG 拓扑执行完成"
        : "DAG 执行完成，部分节点无结果",
      toolResults,
      checkerPassed: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DAG 执行失败";
    return { error: msg };
  }
};
