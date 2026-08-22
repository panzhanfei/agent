/**
 * Intake 工具规划（不执行）：按 schema 给槽盖 toolId / dataSource。
 * 主路径 from-llm 已写 toolId；本文件供 compile-path-plan 兜底与单测。
 */
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import type { IntakeRetrievalPlanItem } from "@/agentflow/agents/online/intake-coordinator/contract";
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import { resolveIdentityFieldFromPlan } from "@/agentflow/agents/online/tool-orchestrator/catalog";
import type {
  DataSource,
  EnrichedPlanItem,
  ToolRunId,
} from "@/agentflow/agents/online/tool-orchestrator/interface";
import { topicsSuggestWebSource } from "./route-signals";

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

export const applyToolPlanGuard = (
  decision: RoutedIntakeDecision,
  _userQuestion: string
): RoutedIntakeDecision => {
  if (decision.intent !== "retrieve_and_answer") return decision;

  const enrichedPlan = enrichRetrievalPlan(decision.retrievalPlan ?? []);
  const enrichedSlots = enrichCompositeSlots(decision.compositeSlots ?? []);

  return {
    ...decision,
    compositeSlots: enrichedSlots,
    enrichedPlan,
  };
};
