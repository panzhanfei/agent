/**
 * DAG 执行期裁剪：仅信上游结构化结果（ok / insufficientEvidence），不猜问句。
 * hard dep 未满足 → skip；optionalDeps（soft）未满足 → 不阻断。
 */
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";

export const isDepSatisfied = (dep: ToolRunResult | undefined): boolean => {
  if (!dep) return false;
  if (!dep.ok) return false;
  if (dep.insufficientEvidence) return false;
  return true;
};

/** 仅 hard deps：任一未满足 → 本节点应 skip */
export const shouldSkipForDeps = (
  depIds: readonly string[],
  prior: Record<string, ToolRunResult>,
  optionalDeps: readonly string[] = []
): boolean => {
  if (depIds.length === 0) return false;
  const optional = new Set(optionalDeps);
  const hard = depIds.filter((id) => !optional.has(id));
  if (hard.length === 0) return false;
  return hard.some((id) => !isDepSatisfied(prior[id]));
};

/** soft 未满足的 dep id（供 notes / degraded） */
export const unsatisfiedOptionalDeps = (
  depIds: readonly string[],
  prior: Record<string, ToolRunResult>,
  optionalDeps: readonly string[] = []
): string[] => {
  const optional = new Set(optionalDeps);
  return depIds.filter(
    (id) => optional.has(id) && !isDepSatisfied(prior[id])
  );
};

export const skippedDepsResult = (input: {
  toolId: ToolRunResult["toolId"];
  label: string;
  missingDeps: string[];
}): ToolRunResult => ({
  toolId: input.toolId,
  label: input.label,
  ok: false,
  answer: `依赖未就绪，已跳过（${input.missingDeps.join(", ") || "deps"}）。`,
  citations: [],
  hits: [],
  insufficientEvidence: true,
  confidence: 0.2,
  skipped: true,
  skipReason: "deps",
});
