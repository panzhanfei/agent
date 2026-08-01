/**
 * 将全局 B 结构化补丁应用到 decision（compositeSlots / pathPlan / executionPlan）。
 */
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import type { ExecutionPlanNode } from "@/agentflow/agents/online/tool-orchestrator/interface";
import type { GlobalRebatchRepair } from "./interface";

const patchSlot = (
  slot: CompositeRetrievalSlot,
  repair: GlobalRebatchRepair
): CompositeRetrievalSlot | null => {
  if (repair.action === "abandon") return null;
  if (repair.action === "use_web_search") {
    const q = (repair.webQuery ?? repair.searchQuery ?? "").trim();
    if (!q) return null;
    return {
      ...slot,
      executor: "tool_run",
      toolId: "search_web",
      dataSource: "web",
      searchQuery: q,
    };
  }
  const q = (repair.searchQuery ?? repair.webQuery ?? "").trim();
  if (!q) return null;
  return { ...slot, searchQuery: q };
};

const patchDagNode = (
  node: ExecutionPlanNode,
  repair: GlobalRebatchRepair
): ExecutionPlanNode | null => {
  if (repair.action === "abandon") return null;
  if (repair.action === "use_web_search") {
    const q = (repair.webQuery ?? repair.searchQuery ?? "").trim();
    if (!q) return null;
    return {
      ...node,
      toolId: "search_web",
      dataSource: "web",
      webQuery: q,
      searchQuery: q,
    };
  }
  const q = (repair.searchQuery ?? repair.webQuery ?? "").trim();
  if (!q) return null;
  if (node.toolId === "search_web" || node.dataSource === "web") {
    return { ...node, webQuery: q, searchQuery: q };
  }
  return { ...node, searchQuery: q };
};

export const applyGlobalRebatchRepairs = (input: {
  decision: RoutedIntakeDecision;
  repairs: readonly GlobalRebatchRepair[];
  allowedSlotIds: ReadonlySet<string>;
  allowedDagNodeIds: ReadonlySet<string>;
}): {
  decision: RoutedIntakeDecision;
  rebatchSlotIds: string[];
  rebatchDag: boolean;
} => {
  const slotRepairs = new Map<string, GlobalRebatchRepair>();
  const dagRepairs = new Map<string, GlobalRebatchRepair>();
  for (const r of input.repairs) {
    if (r.kind === "dag_node") {
      if (input.allowedDagNodeIds.has(r.targetId)) {
        dagRepairs.set(r.targetId, r);
      }
      continue;
    }
    if (input.allowedSlotIds.has(r.targetId)) {
      slotRepairs.set(r.targetId, r);
    }
  }

  const rebatchSlotIds: string[] = [];
  const slots = (input.decision.compositeSlots ?? []).map((slot) => {
    const id = String(slot.id);
    const repair = slotRepairs.get(id);
    if (!repair) return slot;
    const next = patchSlot(slot, repair);
    if (!next) return slot;
    rebatchSlotIds.push(id);
    return next;
  });

  let executionPlan = input.decision.executionPlan
    ? [...input.decision.executionPlan]
    : undefined;
  let rebatchDag = false;
  if (executionPlan && dagRepairs.size > 0) {
    executionPlan = executionPlan.map((node) => {
      const repair = dagRepairs.get(node.id);
      if (!repair) return node;
      const next = patchDagNode(node, repair);
      if (!next) return node;
      rebatchDag = true;
      return next;
    });
  }

  let pathPlan = input.decision.pathPlan;
  if (pathPlan?.steps?.length && rebatchSlotIds.length > 0) {
    const qById = new Map(
      slots
        .filter((s) => rebatchSlotIds.includes(String(s.id)))
        .map((s) => [String(s.id), s] as const)
    );
    pathPlan = {
      ...pathPlan,
      steps: pathPlan.steps.map((step) => {
        const slot = qById.get(String(step.id));
        if (!slot) return step;
        return {
          ...step,
          searchQuery: slot.searchQuery,
          toolId: slot.toolId ?? step.toolId,
          dataSource: slot.dataSource ?? step.dataSource,
          kind:
            slot.executor === "tool_run"
              ? "tool"
              : slot.executor === "list_corpus"
                ? "list"
                : slot.executor === "mem_recall"
                  ? "mem"
                  : slot.executor === "summarize_slot"
                    ? "summarize"
                    : step.kind,
        };
      }),
    };
  }

  return {
    decision: {
      ...input.decision,
      compositeSlots: slots,
      executionPlan,
      pathPlan,
    },
    rebatchSlotIds,
    rebatchDag,
  };
};
