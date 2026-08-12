/**
 * DAG 再批：强制重跑节点 ∪ 下游依赖闭包。
 * 仅信 deps 边，不猜问句。
 */
import type { ExecutionPlanNode } from "@/agentflow/agents/online/tool-orchestrator/interface";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";

/** 从 force 根出发，收集须重跑的节点（含传递下游） */
export const collectDownstreamRerunClosure = (
  plan: readonly ExecutionPlanNode[],
  forceRerunIds: ReadonlySet<string> | readonly string[]
): Set<string> => {
  const force = new Set(
    [...forceRerunIds].map((id) => String(id).trim()).filter(Boolean)
  );
  if (force.size === 0) return new Set();

  const byId = new Map(plan.map((n) => [n.id, n] as const));
  const rerun = new Set(force);

  let grew = true;
  while (grew) {
    grew = false;
    for (const node of plan) {
      if (rerun.has(node.id)) continue;
      const deps = node.deps ?? [];
      if (deps.some((d) => rerun.has(d))) {
        rerun.add(node.id);
        grew = true;
      }
    }
  }

  // 仅保留 plan 内 id
  for (const id of [...rerun]) {
    if (!byId.has(id)) rerun.delete(id);
  }
  return rerun;
};

/** seed 结果是否可在再批时复用（deps-skip / 失败 / 不足 不可复用） */
export const canReuseDagNodeResult = (
  result: ToolRunResult | undefined
): boolean => {
  if (!result) return false;
  if (result.skipped) return false;
  if (!result.ok) return false;
  if (result.insufficientEvidence) return false;
  return true;
};
