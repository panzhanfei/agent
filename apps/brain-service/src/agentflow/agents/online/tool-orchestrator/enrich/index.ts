import type { IntakeRetrievalPlanItem } from "@/agentflow/agents/online/intake-coordinator/contract";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator";
import type { QueryProfile } from "@/agentflow/agents/online/knowledge-manager";
import { buildHybridExecutionPlan } from "@/agentflow/agents/online/dag-executor/hybrid-plan";
import {
    decisionSuggestsHybridDag,
    resolveIdentityFieldFromPlan,
    topicsSuggestWebSource,
} from "../catalog";
import type { DataSource, EnrichedPlanItem, ToolRunId } from "../interface";
import { resolveIntakeGraphRouteMode } from "@/agentflow/agents/online/intake-coordinator/pipeline";

const enrichItem = (
    item: Pick<
        IntakeRetrievalPlanItem,
        "label" | "searchQuery" | "queryType" | "topics" | "identityField"
    >
): EnrichedPlanItem => {
    const fieldSpec = resolveIdentityFieldFromPlan({
        identityField: item.identityField,
    });
    let dataSource: DataSource = "corpus";
    let toolId: ToolRunId | null = null;

    if (topicsSuggestWebSource(item.topics)) {
        dataSource = "web";
        toolId = "search_web";
    } else if (item.queryType === "enumeration") {
        // list 取数在 retrieval 按槽执行；工具层负责 compose 成稿
        toolId = "compose_enumeration";
    } else if (fieldSpec?.toolId) {
        dataSource = fieldSpec.requiresCompute ? "compute" : "corpus";
        toolId = fieldSpec.toolId;
    } else if (item.queryType === "external_link") {
        toolId = "extract_external_links_from_hits";
    }

    return {
        label: item.label,
        searchQuery: item.searchQuery,
        queryType: item.queryType,
        topics: [...item.topics],
        dataSource,
        field: fieldSpec?.id ?? null,
        toolId,
    };
};

export const enrichRetrievalPlan = (
    plan: IntakeRetrievalPlanItem[]
): EnrichedPlanItem[] => plan.map(enrichItem);

export const enrichCompositeSlots = (
    slots: CompositeRetrievalSlot[]
): Array<CompositeRetrievalSlot & EnrichedPlanItem> =>
    slots.map((slot) => ({
        ...slot,
        ...enrichItem(slot),
    }));

/**
 * Intake guard ⑧：工具 / 数据源规划（不执行工具）。
 *
 * 本步新增/改写：
 *   + enrichedPlan[]（每项 dataSource + toolId）
 *   Δ compositeSlots 挂上 enrich 字段
 *   或 + executionPlan（external∩corpus → hybrid DAG；可与 slots 并存；routeMode=plan）
 *
 * 联网由槽 topics.external → toolId=search_web / pathPlan.tool 表达，
 * 不再写整轮 primaryDataSource / webQuery。
 * toolId 映射信 schema：identityField / queryType / topics，无口语词表。
 */
export const applyToolPlanGuard = (
    decision: RoutedIntakeDecision,
    userQuestion: string
): RoutedIntakeDecision => {
    if (decision.intent !== "retrieve_and_answer") return decision;

    const enrichedPlan = enrichRetrievalPlan(decision.retrievalPlan ?? []);
    const enrichedSlots = enrichCompositeSlots(decision.compositeSlots ?? []);

    const planTopics = (decision.retrievalPlan ?? []).map((p) => p.topics);
    if (
        decisionSuggestsHybridDag({
            topics: decision.topics,
            planTopics,
        })
    ) {
        const next: RoutedIntakeDecision = {
            ...decision,
            routeMode: "planFanOut",
            compositeSlots: enrichedSlots,
            retrievalPlan: enrichedPlan.map(
                ({ label, searchQuery, queryType, topics }) => ({
                    label,
                    searchQuery,
                    queryType: queryType as QueryProfile,
                    topics,
                })
            ),
            executionPlan: buildHybridExecutionPlan(userQuestion, decision),
            routeReason: decision.routeReason ?? "intake_retrieval_plan",
        };
        next.routeMode = resolveIntakeGraphRouteMode(next);
        return next;
    }

    return {
        ...decision,
        compositeSlots: enrichedSlots,
        enrichedPlan,
    };
};
