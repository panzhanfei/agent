/**
 * planExecutor：slots + dag 混排时，按 answerOrder 合并 stepResults / compositeSubResults。
 */
import type {
  CompositeSlotPlan,
  CompositeSubRetrieval,
  IncrementalCompositePlan,
} from "@/agentflow/agents/online/knowledge-manager/composite/interface";
import type {
  DagRun,
  PathPlan,
  StepResult,
} from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/types";

const isDagStepId = (pathPlan: PathPlan, stepId: string): boolean =>
  pathPlan.dag.some((d) => d.id === stepId);

export const mergeStepResultsByAnswerOrder = (
  answerOrder: string[],
  pathPlan: PathPlan,
  slotResults: StepResult[],
  dagResults: StepResult[]
): StepResult[] => {
  const byId = new Map<string, StepResult>();
  for (const r of [...slotResults, ...dagResults]) {
    byId.set(r.stepId, r);
  }
  const ordered: StepResult[] = [];
  const seen = new Set<string>();
  for (const id of answerOrder) {
    const r = byId.get(id);
    if (r && !seen.has(id)) {
      ordered.push(r);
      seen.add(id);
    }
  }
  for (const r of [...slotResults, ...dagResults]) {
    if (!seen.has(r.stepId)) {
      ordered.push(r);
      seen.add(r.stepId);
    }
  }
  return ordered;
};

export const buildDagStepResults = (
  pathPlan: PathPlan,
  dagPatch: Partial<PipelineGraphState>
): StepResult[] => {
  const hybridRuns = pathPlan.dag.filter(
    (d) => d.template === "hybrid_multi_source"
  );
  if (hybridRuns.length === 0) {
    return [
      {
        stepId: "dag-hybrid",
        pathKind: "dag",
        label: "综合评估",
        hits: dagPatch.hits ?? [],
        coverage: dagPatch.coverage ?? "none",
        notes: dagPatch.notes ?? null,
        fc: { passed: true },
      },
    ];
  }
  return hybridRuns.map((dagRun) => ({
    stepId: dagRun.id,
    pathKind: "dag" as const,
    label: dagRun.label,
    hits: dagPatch.hits ?? [],
    coverage: dagPatch.coverage ?? "none",
    notes: dagPatch.notes ?? null,
    fc: { passed: true },
  }));
};

export const mergeCompositeWithDagSteps = (
  state: PipelineGraphState,
  pathPlan: PathPlan,
  answerOrder: string[],
  dagRuns: DagRun[],
  dagPatch: Partial<PipelineGraphState>
): Pick<
  PipelineGraphState,
  "compositeSubResults" | "compositeIncrementalPlan" | "hits" | "coverage" | "notes"
> => {
  const synthesis = (dagPatch.toolResults as PipelineToolResults | undefined)
    ?.synthesis;
  const dagSubsById = new Map<string, CompositeSubRetrieval>();
  const dagPlansById = new Map<string, CompositeSlotPlan>();

  for (const dagRun of dagRuns) {
    dagSubsById.set(dagRun.id, {
      slot: dagRun.id,
      facetKey: `dag:${dagRun.id}`,
      label: dagRun.label,
      hits: dagPatch.hits ?? [],
      coverage: dagPatch.coverage ?? "partial",
      notes: synthesis?.answer ?? dagPatch.notes ?? null,
      cacheHit: false,
      facetAnswerCacheHit: false,
    });
    dagPlansById.set(dagRun.id, {
      id: dagRun.id,
      label: dagRun.label,
      searchQuery: dagRun.label,
      queryType: "default",
      topics: [],
      subTasks: [dagRun.label],
      facetKey: `dag:${dagRun.id}`,
      useCachedAnswer: false,
      cachedAnswer: null,
    });
  }

  const slotById = new Map(
    (state.compositeSubResults ?? []).map((s) => [String(s.slot), s])
  );
  const planById = new Map(
    (state.compositeIncrementalPlan?.slots ?? []).map((p) => [String(p.id), p])
  );

  const compositeSubResults: CompositeSubRetrieval[] = [];
  const slots: CompositeSlotPlan[] = [];
  const order =
    answerOrder.length > 0
      ? answerOrder
      : [
          ...Array.from(slotById.keys()),
          ...dagRuns.map((d) => d.id),
        ];

  for (const id of order) {
    if (isDagStepId(pathPlan, id)) {
      const sub = dagSubsById.get(id);
      const plan = dagPlansById.get(id);
      if (sub && plan) {
        compositeSubResults.push(sub);
        slots.push(plan);
      }
      continue;
    }
    const sub = slotById.get(id);
    const plan = planById.get(id);
    if (sub && plan) {
      compositeSubResults.push(sub);
      slots.push(plan);
    }
  }

  const basePlan = state.compositeIncrementalPlan;
  const compositeIncrementalPlan: IncrementalCompositePlan | null = basePlan
    ? {
        ...basePlan,
        slots,
      }
    : slots.length > 0
      ? {
          slots,
          activeRetrievalSlots: [],
          facetCacheHits: 0,
          sessionCleared: false,
        }
      : null;

  return {
    compositeSubResults,
    compositeIncrementalPlan,
    hits: [...(state.hits ?? []), ...(dagPatch.hits ?? [])],
    coverage: dagPatch.coverage ?? state.coverage,
    notes: [state.notes, dagPatch.notes].filter(Boolean).join(" ") || state.notes,
  };
};
