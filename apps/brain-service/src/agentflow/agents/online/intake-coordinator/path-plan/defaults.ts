import type { ComposeMode, ExecutionStep, PathKind, PathPlan, PathPlanCounts } from "./interface";

export const emptyPathPlan = (): PathPlan => ({
  steps: [],
});

export const defaultComposeMode = (): ComposeMode => "qa";

export const countPathPlan = (plan: PathPlan | null | undefined): PathPlanCounts => {
  const steps = plan?.steps ?? [];
  let km = 0;
  let list = 0;
  let tool = 0;
  let dag = 0;
  for (const s of steps) {
    if (s.kind === "km") km++;
    else if (s.kind === "list") list++;
    else if (s.kind === "tool") tool++;
    else if (s.kind === "dag") dag++;
  }
  return { km, list, tool, dag, total: steps.length };
};

export const stepsOfKind = <K extends PathKind>(
  plan: PathPlan | null | undefined,
  kind: K
): Array<ExecutionStep & { kind: K }> =>
  (plan?.steps ?? []).filter(
    (s): s is ExecutionStep & { kind: K } => s.kind === kind
  );

/** 兼容旧日志/断言：从 steps 派生四桶视图（只读，不用于执行顺序） */
export const pathPlanBuckets = (plan: PathPlan | null | undefined) => ({
  km: stepsOfKind(plan, "km"),
  list: stepsOfKind(plan, "list"),
  tool: stepsOfKind(plan, "tool"),
  dag: stepsOfKind(plan, "dag"),
});
