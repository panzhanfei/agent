import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { fetchListSlot } from "../fetch-list-slot";
import { flattenListRetrieval } from "../flatten-list-retrieval";

/**
 * LangGraph `listRetriever` 节点：纯列举分页（UI 短路 / exhaustive / continue）。
 *
 * 入口：Intake 将 routeMode 收成 `listRetriever`（pathPlan 仅 list 槽、无 km/tool/dag）。
 * 跳过 planExecutor、FC、tool 编排；后段 contentOrganizer → analyst（不经 contentSummarizer）。
 */
export const runListRetrieverNode = async (
    state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
    const decision = state.decision;
    if (!decision) {
        return { error: "缺少入口路由决策" };
    }

    const slots = decision.compositeSlots ?? [];
    if (slots.length === 0) {
        return { error: "纯 list 路由缺少槽位定义" };
    }

    logAgentOut("ListRetriever", "进入", {
        slotCount: slots.length,
        listKinds: slots.map(
            (s) => s.enumerationControl?.listKind ?? s.label
        ),
    });

    try {
        const subResults = await Promise.all(
            slots.map((slot) =>
                fetchListSlot(
                    slot,
                    state.context.corpusUserId,
                    state.asOfDate ?? null
                )
            )
        );

        const flattened = flattenListRetrieval(subResults);

        logAgentOut("ListRetriever", "完成", {
            hitCount: flattened.hits.length,
            coverage: flattened.coverage,
            page: flattened.enumerationMeta?.page ?? null,
            hasMore: flattened.enumerationMeta?.hasMore ?? null,
        });

        return {
            hits: flattened.hits,
            coverage: flattened.coverage,
            notes: flattened.notes,
            confidenceTier: flattened.confidenceTier,
            enumerationMeta: flattened.enumerationMeta,
            compositeSubResults: subResults,
            compositeIncrementalPlan: null,
            retrievalCacheHit: false,
            retrievalCacheSlotHits: null,
            checkerPassed: true,
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : "列举分页检索失败";
        return { error: msg };
    }
};
