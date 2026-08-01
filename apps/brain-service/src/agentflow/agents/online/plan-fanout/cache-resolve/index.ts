/**
 * planCacheResolve：planFanOut 前一次性 resolve facet + km hits 缓存计划，
 * 并初始化 slotRuntimeById（pending）+ 从 env 载入统一预算。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { resolveCompositeCachePlan } from "@/agentflow/cache";
import {
  createPendingSlot,
  loadRetryPolicyFromEnv,
} from "@/agentflow/execution";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

export const runPlanCacheResolveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  if (!decision) {
    return { error: "缺少入口路由决策" };
  }

  const slots = decision.compositeSlots ?? [];
  logAgentOut("PlanCacheResolve", "进入", { slotCount: slots.length });

  try {
    const plan = await resolveCompositeCachePlan({
      session: {
        conversationId: state.context.conversationId,
        corpusUserId: state.context.corpusUserId,
      },
      userQuestion: state.userQuestion,
      slots,
      corpusUserId: state.context.corpusUserId,
      prefetchHits: true,
    });

    const retryPolicy = loadRetryPolicyFromEnv();
    const slotRuntimeById = Object.fromEntries(
      slots.map((s) => [String(s.id), createPendingSlot(String(s.id))])
    );

    logAgentOut("PlanCacheResolve", "完成", {
      facetCacheHits: plan.facetCacheHits,
      hitsCacheHits: plan.hitsCacheHits,
      activeRetrievalCount: plan.activeRetrievalSlots.length,
      slotCount: slots.length,
      retryPolicy,
    });

    return {
      compositeIncrementalPlan: plan,
      retryPolicy,
      slotRuntimeById,
      globalRebatchUsed: false,
      pendingGlobalRebatchSlotIds: [],
      pendingGlobalRebatchDag: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "缓存计划解析失败";
    return { error: msg };
  }
};
