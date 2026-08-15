import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import type {
  PathPlan,
  StepResult,
} from "@/agentflow/agents/online/intake-coordinator/path-plan";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import type {
  ExecutionPlanNode,
  PipelineToolResults,
} from "@/agentflow/agents/online/tool-orchestrator/interface";

/** planMerge 套 emptyPolicy 的入参 */
export type EmptyPolicyApplyInput = {
  /** 步级策略优先从这里取 */
  pathPlan: PathPlan;
  /** 无对应 pathPlan 步时，用槽上的 emptyPolicy 补齐 */
  slots: readonly CompositeRetrievalSlot[];
  stepResults: StepResult[];
  compositeSubResults: CompositeSubRetrieval[] | null;
  /** DAG 节点 require 检查用 */
  executionPlan?: ExecutionPlanNode[] | null;
  /** 与 executionPlan[].id 对齐的节点结果 */
  dagToolResults?: PipelineToolResults | null;
};

export type EmptyPolicyApplyResult = {
  /** 已按 omit 过滤后的步结果（require 失败时原样返回，供错误页对照） */
  stepResults: StepResult[];
  /** 同步 omit 后的分槽结果；无 composite 时为 null */
  compositeSubResults: CompositeSubRetrieval[] | null;
  /** 因 omit+空证据被拿掉的 stepId */
  omittedStepIds: string[];
  /** require 步/节点仍空时的整轮错误文案；否则 null */
  requireError: string | null;
};
