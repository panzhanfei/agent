/**
 * 执行期空证据策略（共享能力，不是图节点）。
 *
 * 被 plan-merge 落地、global-rebatch 筛候选共用；不放进任一子目录，避免对方深挖。
 * Intake `path-plan/empty-policy` 只做 schema 合法化（非法 → degrade）；
 * 本目录是执行期 apply：合并后按策略硬失败 / 省略 / 放行。
 *
 * require：再批后仍空 → 整轮 error
 * omit：空则从 stepResults / compositeSubResults 拿掉；也不进全局 B
 * degrade（缺省）：带着缺口继续
 */
import type { EmptyPolicy, ExecutionStep, StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan";
import { DEFAULT_EMPTY_POLICY } from "@/agentflow/agents/online/intake-coordinator/path-plan";
import type { PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/interface";
import type {
  EmptyPolicyApplyInput,
  EmptyPolicyApplyResult,
} from "./interface";

export type { EmptyPolicyApplyInput, EmptyPolicyApplyResult } from "./interface";

const policyOf = (raw: EmptyPolicy | undefined): EmptyPolicy =>
  raw ?? DEFAULT_EMPTY_POLICY;

/** 槽 / pathPlan 步：有工具成功、有 hits、或 coverage 非 none → 不算空 */
export const isStepEvidenceEmpty = (step: StepResult): boolean => {
  if (step.toolOutput?.ok) return false;
  if ((step.hits?.length ?? 0) > 0) return false;
  if (step.coverage === "sufficient" || step.coverage === "partial") {
    return false;
  }
  return true;
};

/** DAG 节点：无结果 / deps-skip / 非 ok / 证据不足 → 空（供 require 检查） */
export const isDagNodeEvidenceEmpty = (
  result: PipelineToolResults[string] | undefined
): boolean => {
  if (!result) return true;
  if (result.skipped && result.skipReason === "deps") return true;
  if (!result.ok) return true;
  if (result.insufficientEvidence) return true;
  return false;
};

/** 合并后按 emptyPolicy 过滤 / 硬失败 */
export const applyEmptyPolicies = (
  input: EmptyPolicyApplyInput
): EmptyPolicyApplyResult => {
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

/** 供全局 B：omit 空槽 / 空 DAG 节点不进再批候选（省预算给可救项） */
export const shouldSalvageForEmptyPolicy = (
  policy: EmptyPolicy | undefined
): boolean => policyOf(policy) !== "omit";

export const stepEmptyPolicy = (
  step: ExecutionStep | undefined
): EmptyPolicy => policyOf(step?.emptyPolicy);
