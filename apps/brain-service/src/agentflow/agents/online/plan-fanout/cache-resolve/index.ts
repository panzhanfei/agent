/**
 * planCacheResolve：Send 工人前的一次编排节点（不是缓存实现）。
 *
 * 为什么收在 plan-fanout，而不是 KM / agentflow/cache：
 * - 读写实现在 `@/agentflow/cache`（facet 会话 + hits 预查）。本文件只接线。
 * - 必须在 fan-out **之前、对全部槽一次** resolve：并行工人不能各自抢读会话快照，
 *   也不能只给 KM 槽做（list/mem/tool 也要 facetKey / resolvedSub）。
 * - 同节点还初始化 fan-out 控制面：slotRuntime、retryPolicy、全局 B 标志。
 *   这些不属于 KM，挂在「即将拆工人」的编排包上。
 *
 * 工人侧：KM 读 compositeIncrementalPlan.slotPlanById[activeSlotId].resolvedSub，
 * 命中则不再查库。本节点不 Send、不改 query。
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
      /** planFanOut 预查 KM hits；纯 list 路径可关 */
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
      /** 全槽缓存计划；工人按 activeSlotId 读 resolvedSub / needsKmRetrieve */
      compositeIncrementalPlan: plan,
      /** 本轮统一预算（SLOT_MAX_ATTEMPTS / SLOT_DEADLINE_MS） */
      retryPolicy,
      /** 每槽 pending，供 Join 对账超时 / 缺补丁 */
      slotRuntimeById,
      /** 新一轮 fan-out：允许最多一次全局 B */
      globalRebatchUsed: false,
      pendingGlobalRebatchSlotIds: [],
      pendingGlobalRebatchDag: false,
      pendingGlobalRebatchDagNodeIds: [],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "缓存计划解析失败";
    return { error: msg };
  }
};
