import type {
  ComposeMode,
  ExecutionStep,
  PathKind,
  PathPlan,
  PathPlanCounts,
} from "./interface";

export const emptyPathPlan = (): PathPlan => ({
  steps: [],
});

export const defaultComposeMode = (): ComposeMode => "qa";

export const countPathPlan = (
  plan: PathPlan | null | undefined
): PathPlanCounts => {
  const steps = plan?.steps ?? [];
  let km = 0;
  let list = 0;
  let mem = 0;
  let tool = 0;
  let summarize = 0;
  let dag = 0;
  let corpus_edit = 0;
  for (const s of steps) {
    if (s.kind === "km") km++;
    else if (s.kind === "list") list++;
    else if (s.kind === "mem") mem++;
    else if (s.kind === "tool") tool++;
    else if (s.kind === "summarize") summarize++;
    else if (s.kind === "dag") dag++;
    else if (s.kind === "corpus_edit") corpus_edit++;
  }
  return {
    km,
    list,
    mem,
    tool,
    summarize,
    dag,
    corpus_edit,
    total: steps.length,
  };
};

export const stepsOfKind = <K extends PathKind>(
  plan: PathPlan | null | undefined,
  kind: K
): Array<ExecutionStep & { kind: K }> =>
  (plan?.steps ?? []).filter(
    (s): s is ExecutionStep & { kind: K } => s.kind === kind
  );

/** 只读分桶视图（日志/断言；执行顺序仍以 steps[] 为准） */
export const pathPlanBuckets = (plan: PathPlan | null | undefined) => ({
  km: stepsOfKind(plan, "km"),
  list: stepsOfKind(plan, "list"),
  mem: stepsOfKind(plan, "mem"),
  tool: stepsOfKind(plan, "tool"),
  summarize: stepsOfKind(plan, "summarize"),
  dag: stepsOfKind(plan, "dag"),
  corpus_edit: stepsOfKind(plan, "corpus_edit"),
});
