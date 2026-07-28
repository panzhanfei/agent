/**
 * planSlotPost：汇合 km+list 补丁 → per-step FC + post-retrieval tools → fanOutSlotPatch。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { runPerStepFactChecks } from "@/agentflow/agents/online/fact-checker/check-step";
import {
  mergeKmAndListRetrieveBundles,
  runRetrievalNode,
} from "@/agentflow/agents/online/knowledge-manager";
import { runToolOrchestratorNode } from "@/agentflow/agents/online/tool-orchestrator";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PlanSlotsPatch } from "../interface";

export const runPlanSlotPostNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  const kmPatch = state.fanOutKmPatch;
  const listPatch = state.fanOutListPatch;

  if (!decision) {
    return {
      fanOutSlotPatch: { error: "缺少入口路由决策", hits: [], coverage: "none" },
    };
  }

  if (kmPatch?.error) {
    return {
      fanOutSlotPatch: { error: kmPatch.error, hits: [], coverage: "none" },
    };
  }
  if (listPatch?.error) {
    return {
      fanOutSlotPatch: { error: listPatch.error, hits: [], coverage: "none" },
    };
  }

  if (!kmPatch && !listPatch) {
    return { fanOutSlotPatch: null };
  }

  const slots = decision.compositeSlots ?? [];
  const mergedRetrieve = mergeKmAndListRetrieveBundles(
    slots,
    {
      subResults: kmPatch?.compositeSubResults ?? [],
      incremental: kmPatch?.compositeIncrementalPlan ?? null,
      cacheHits: kmPatch?.retrievalCacheSlotHits ?? 0,
    },
    {
      subResults: listPatch?.compositeSubResults ?? [],
      incremental: null,
      cacheHits: 0,
    }
  );

  logAgentOut("PlanSlotPost", "进入", {
    hitCount: mergedRetrieve.hits.length,
    kmSubs: kmPatch?.compositeSubResults?.length ?? 0,
    listSubs: listPatch?.compositeSubResults?.length ?? 0,
  });

  let working: PipelineGraphState = {
    ...state,
    ...mergedRetrieve,
  };

  const runFc = async (st: PipelineGraphState) =>
    runPerStepFactChecks({
      userQuestion: st.userQuestion,
      decision: st.decision!,
      compositeSubResults: st.compositeSubResults ?? [],
      retryCount: st.retryCount,
      retrievalCacheHit: st.retrievalCacheHit,
    });

  let fc = await runFc(working);

  if (fc.refinedDecision && working.retryCount < 1) {
    logAgentOut("PlanSlotPost", "per-step FC 局部重试", {
      refinedSearchQuery: fc.refinedDecision.searchQuery,
    });
    working = {
      ...working,
      decision: fc.refinedDecision,
      checkerPassed: false,
      retryCount: working.retryCount,
    };
    const retrievalPatch = await runRetrievalNode(working);
    if (retrievalPatch.error) {
      return {
        fanOutSlotPatch: {
          error: retrievalPatch.error,
          hits: [],
          coverage: "none",
        },
      };
    }
    working = {
      ...working,
      ...retrievalPatch,
      retryCount: working.retryCount + 1,
    };
    fc = await runFc(working);
  }

  working = {
    ...working,
    stepResults: fc.stepResults,
    checkerPassed: true,
    notes:
      [working.notes, fc.notes].filter(Boolean).join(" ") || working.notes,
  };

  const toolPatch = await runToolOrchestratorNode(working);
  working = { ...working, ...toolPatch };

  const patch: PlanSlotsPatch = {
    hits: working.hits,
    coverage: working.coverage,
    notes: working.notes,
    confidenceTier: working.confidenceTier,
    enumerationMeta: working.enumerationMeta,
    retrievalCacheHit: working.retrievalCacheHit,
    retrievalCacheSlotHits: working.retrievalCacheSlotHits,
    compositeSubResults: working.compositeSubResults,
    compositeIncrementalPlan: working.compositeIncrementalPlan,
    compositeFacetCacheHits: working.compositeFacetCacheHits,
    checkerPassed: true,
    retryCount: working.retryCount,
    error: working.error,
    slotStepResults: fc.stepResults,
    toolResults: working.toolResults,
  };

  logAgentOut("PlanSlotPost", "完成", {
    hitCount: patch.hits?.length ?? 0,
    stepCount: patch.slotStepResults?.length ?? 0,
    toolKeys: Object.keys(patch.toolResults ?? {}),
  });

  return { fanOutSlotPatch: patch };
};
