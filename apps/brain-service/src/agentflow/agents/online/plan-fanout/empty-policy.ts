/**
 * planMerge 空证据策略：require / omit / degrade。
 */
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import type {
  EmptyPolicy,
  ExecutionStep,
  PathPlan,
  StepResult,
} from "@/agentflow/agents/online/intake-coordinator/path-plan";
import type {
  ExecutionPlanNode,
  PipelineToolResults,
} from "@/agentflow/agents/online/tool-orchestrator/interface";
import { DEFAULT_EMPTY_POLICY } from "@/agentflow/agents/online/intake-coordinator/path-plan/empty-policy";

const policyOf = (raw: EmptyPolicy | undefined): EmptyPolicy =>
  raw ?? DEFAULT_EMPTY_POLICY;

export const isStepEvidenceEmpty = (step: StepResult): boolean => {
  if (step.toolOutput?.ok) return false;
  if ((step.hits?.length ?? 0) > 0) return false;
  if (step.coverage === "sufficient" || step.coverage === "partial") {
    return false;
  }
  return true;
};

export const isDagNodeEvidenceEmpty = (
  result: PipelineToolResults[string] | undefined
): boolean => {
  if (!result) return true;
  if (result.skipped && result.skipReason === "deps") return true;
  if (!result.ok) return true;
  if (result.insufficientEvidence) return true;
  return false;
};

export type EmptyPolicyApplyResult = {
  stepResults: StepResult[];
  compositeSubResults: CompositeSubRetrieval[] | null;
  omittedStepIds: string[];
  /** require 仍空 → 非 null */
  requireError: string | null;
};

/** 合并后按 emptyPolicy 过滤 / 硬失败 */
export const applyEmptyPolicies = (input: {
  pathPlan: PathPlan;
  slots: readonly CompositeRetrievalSlot[];
  stepResults: StepResult[];
  compositeSubResults: CompositeSubRetrieval[] | null;
  executionPlan?: ExecutionPlanNode[] | null;
  dagToolResults?: PipelineToolResults | null;
}): EmptyPolicyApplyResult => {
  const policyByStepId = new Map<string, EmptyPolicy>();
  for (const step of input.pathPlan.steps) {
    policyByStepId.set(String(step.id), policyOf(step.emptyPolicy));
  }
  for (const slot of input.slots) {
    if (!policyByStepId.has(String(slot.id))) {
      policyByStepId.set(String(slot.id), policyOf(slot.emptyPolicy));
    }
  }

  const requireFails: string[] = [];
  for (const step of input.stepResults) {
    const id = String(step.stepId);
    const policy = policyByStepId.get(id) ?? DEFAULT_EMPTY_POLICY;
    if (policy === "require" && isStepEvidenceEmpty(step)) {
      requireFails.push(step.label || id);
    }
  }

  for (const node of input.executionPlan ?? []) {
    const policy = policyOf(node.emptyPolicy);
    if (policy !== "require") continue;
    if (isDagNodeEvidenceEmpty(input.dagToolResults?.[node.id])) {
      requireFails.push(node.label || node.id);
    }
  }

  if (requireFails.length > 0) {
    return {
      stepResults: input.stepResults,
      compositeSubResults: input.compositeSubResults,
      omittedStepIds: [],
      requireError: `必答步骤无可用证据：${requireFails.join("、")}`,
    };
  }

  const omitIds = new Set<string>();
  for (const step of input.stepResults) {
    const id = String(step.stepId);
    const policy = policyByStepId.get(id) ?? DEFAULT_EMPTY_POLICY;
    if (policy === "omit" && isStepEvidenceEmpty(step)) {
      omitIds.add(id);
    }
  }

  // dag 步本身：若 hybrid 整步在 stepResults 里且 synthesis/resume require 已在上面处理；
  // omit 的外搜节点不删 dag StepResult（综合步仍可能有答案）。

  const stepResults = input.stepResults.filter(
    (s) => !omitIds.has(String(s.stepId))
  );
  const compositeSubResults = input.compositeSubResults
    ? input.compositeSubResults.filter((s) => !omitIds.has(String(s.slot)))
    : null;

  return {
    stepResults,
    compositeSubResults,
    omittedStepIds: [...omitIds],
    requireError: null,
  };
};

/** 供全局 B：omit 空槽不进再批候选 */
export const shouldSalvageForEmptyPolicy = (
  policy: EmptyPolicy | undefined
): boolean => policyOf(policy) !== "omit";

export const stepEmptyPolicy = (
  step: ExecutionStep | undefined
): EmptyPolicy => policyOf(step?.emptyPolicy);
