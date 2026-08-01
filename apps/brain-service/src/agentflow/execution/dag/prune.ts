/**
 * DAG 执行期裁剪：仅信上游结构化结果（ok / insufficientEvidence），不猜问句。
 */
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";

export const isDepSatisfied = (dep: ToolRunResult | undefined): boolean => {
  if (!dep) return false;
  if (!dep.ok) return false;
  if (dep.insufficientEvidence) return false;
  return true;
};

/** deps 中任一未满足 → 本节点应 skip */
export const shouldSkipForDeps = (
  depIds: readonly string[],
  prior: Record<string, ToolRunResult>
): boolean => {
  if (depIds.length === 0) return false;
  return depIds.some((id) => !isDepSatisfied(prior[id]));
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
