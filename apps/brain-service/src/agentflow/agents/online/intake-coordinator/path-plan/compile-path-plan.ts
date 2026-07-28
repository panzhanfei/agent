/**
 * 兼容路径：从 compositeSlots 编译有序 PathPlan.steps。
 * 主路径已是 LLM 直接出 steps[]；本文件仅兜底/测试。
 */
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import {
  decisionSuggestsHybridDag,
  topicsSuggestWebSource,
} from "@/agentflow/agents/online/tool-orchestrator/catalog";
import { enrichCompositeSlots } from "@/agentflow/agents/online/tool-orchestrator";
import { expandHybridMultiSourceTemplate } from "./dag-templates";
import { emptyPathPlan } from "./defaults";
import { resolveIntakeGraphRouteMode } from "@/agentflow/agents/online/intake-coordinator/pipeline/resolve-graph-route-mode";
import type {
  ComposeMode,
  ExecutionStep,
  PathPlan,
} from "./interface";

const resolveComposeMode = (
  decision: RoutedIntakeDecision,
  plan: PathPlan
): ComposeMode => {
  if (decision.intent === "summarize_content") return "summarize";
  if (plan.steps.length >= 2) return "composite";
  return "qa";
};

/**
 * 从 compositeSlots / topics 编译有序 PathPlan（不重排：信 slots 顺序）。
 */
export const compilePathPlan = (
  decision: RoutedIntakeDecision,
  _userQuestion: string
): { pathPlan: PathPlan; composeMode: ComposeMode } => {
  if (decision.intent !== "retrieve_and_answer") {
    if (decision.intent === "summarize_content") {
      const steps: ExecutionStep[] =
        decision.searchQuery.trim().length > 0
          ? [
              {
                id: "km-0",
                kind: "km",
                label: "摘要检索",
                searchQuery: decision.searchQuery,
                queryType: decision.queryType ?? "default",
                topics: [...decision.topics],
              },
            ]
          : [];
      return {
        pathPlan: { steps },
        composeMode: "summarize",
      };
    }
    return { pathPlan: emptyPathPlan(), composeMode: "qa" };
  }

  const slots = decision.compositeSlots ?? [];
  const planTopics = (decision.retrievalPlan ?? []).map((p) => p.topics);
  const hybrid = decisionSuggestsHybridDag({
    topics: decision.topics,
    planTopics,
  });

  if (hybrid) {
    const pathPlan: PathPlan = {
      steps: [
        {
          id: "dag-hybrid",
          kind: "dag",
          label: "多源综合评估",
          searchQuery: decision.searchQuery || _userQuestion,
          queryType: "default",
          topics: [...decision.topics],
          template: "hybrid_multi_source",
          deps: [],
        },
      ],
    };
    return { pathPlan, composeMode: "qa" };
  }

  const steps: ExecutionStep[] = [];

  for (const slot of slots) {
    const isList =
      slot.queryType === "enumeration" && slot.executor === "list_corpus";

    if (isList) {
      steps.push({
        id: String(slot.id || `list-${steps.length}`),
        kind: "list",
        label: slot.label,
        searchQuery: slot.searchQuery,
        queryType: "enumeration",
        topics: [...slot.topics],
        identityField: null,
        enumerationControl: slot.enumerationControl ?? null,
        enumerationPage: slot.enumerationPage,
        enumerationPageSize: slot.enumerationPageSize,
        toolId: "compose_enumeration",
        dataSource: "corpus",
      });
      continue;
    }

    if (topicsSuggestWebSource(slot.topics)) {
      steps.push({
        id: String(slot.id || `tool-${steps.length}`),
        kind: "tool",
        label: slot.label,
        searchQuery: slot.searchQuery,
        queryType: slot.queryType,
        topics: [...slot.topics],
        identityField: slot.identityField ?? null,
        toolId: "search_web",
        dataSource: "web",
      });
      continue;
    }

    steps.push({
      id: String(slot.id || `km-${steps.length}`),
      kind: "km",
      label: slot.label,
      searchQuery: slot.searchQuery,
      queryType: slot.queryType,
      topics: [...slot.topics],
      identityField: slot.identityField ?? null,
      toolId: slot.toolId ?? null,
      dataSource: slot.dataSource ?? "corpus",
    });
  }

  if (
    !steps.some((s) => s.kind === "tool") &&
    topicsSuggestWebSource(decision.topics) &&
    steps.length > 0
  ) {
    steps.push({
      id: "tool-web",
      kind: "tool",
      label: "外部检索",
      searchQuery: decision.searchQuery || _userQuestion,
      queryType: decision.queryType ?? "default",
      topics: [...decision.topics],
      toolId: "search_web",
      dataSource: "web",
    });
  }

  const pathPlan: PathPlan = { steps };
  return {
    pathPlan,
    composeMode: resolveComposeMode(decision, pathPlan),
  };
};

/** pathPlan → compositeSlots（仅兜底） */
export const pathPlanToCompositeSlots = (
  plan: PathPlan
): CompositeRetrievalSlot[] => {
  const slots: CompositeRetrievalSlot[] = [];
  for (const s of plan.steps) {
    if (s.kind === "dag") continue;
    if (s.kind === "list") {
      slots.push({
        id: s.id,
        label: s.label,
        searchQuery: s.searchQuery,
        queryType: "enumeration",
        topics: s.topics,
        subTasks: [s.label],
        executor: "list_corpus",
        enumerationControl: s.enumerationControl ?? null,
        identityField: null,
        enumerationPage: s.enumerationPage,
        enumerationPageSize: s.enumerationPageSize,
      });
      continue;
    }
    slots.push({
      id: s.id,
      label: s.label,
      searchQuery: s.searchQuery,
      queryType: s.queryType,
      topics: s.topics,
      subTasks: [s.label],
      executor: "km_retrieve",
      identityField: s.identityField ?? null,
      toolId: s.toolId ?? null,
      dataSource: s.dataSource ?? "corpus",
    });
  }
  return slots;
};

const normalizeSlotForPathPlan = (
  slot: CompositeRetrievalSlot
): CompositeRetrievalSlot => ({
  ...slot,
  executor: slot.executor ?? "km_retrieve",
  enumerationControl:
    slot.queryType === "enumeration" ? (slot.enumerationControl ?? null) : null,
});

/**
 * Intake guard 兜底：编译有序 PathPlan + composeMode。
 */
export const applyPathPlanGuard = (
  decision: RoutedIntakeDecision,
  userQuestion: string
): RoutedIntakeDecision => {
  const { pathPlan, composeMode } = compilePathPlan(decision, userQuestion);
  const isHybrid = pathPlan.steps.some(
    (d) => d.kind === "dag" && d.template === "hybrid_multi_source"
  );

  const orderedSlots =
    (decision.compositeSlots?.length ?? 0) > 0
      ? decision.compositeSlots!.map(normalizeSlotForPathPlan)
      : pathPlanToCompositeSlots(pathPlan);

  const enrichedSlots = enrichCompositeSlots(orderedSlots);

  const next: RoutedIntakeDecision = {
    ...decision,
    pathPlan,
    composeMode,
    answerOrder:
      decision.answerOrder?.length
        ? decision.answerOrder
        : enrichedSlots.map((s) => String(s.id)),
    compositeSlots: enrichedSlots,
    routeMode: decision.routeMode,
    executionPlan: isHybrid
      ? (decision.executionPlan ??
        expandHybridMultiSourceTemplate(userQuestion, decision.searchQuery))
      : decision.executionPlan,
  };
  next.routeMode = resolveIntakeGraphRouteMode(next);
  return next;
};
