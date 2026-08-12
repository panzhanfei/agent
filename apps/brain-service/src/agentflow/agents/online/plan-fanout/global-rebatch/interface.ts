/**
 * Join 后全局协调 B：结构化补丁类型（无口语规则）。
 */
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator/guards/interface";

export type GlobalRebatchAction =
  | "rewrite_search_query"
  | "use_web_search"
  | "abandon";

/** LLM 单条结构化修理（slot 或 DAG 节点） */
export type GlobalRebatchRepair = {
  /** compositeSlots.id 或 executionPlan[].id */
  targetId: string;
  /** slot = 槽工人；dag_node = DAG 执行节点 */
  kind: "slot" | "dag_node";
  action: GlobalRebatchAction;
  searchQuery?: string | null;
  webQuery?: string | null;
};

export type GlobalRebatchPlanResult = {
  decision: RoutedIntakeDecision;
  /** 需再批的槽 id（已应用 rewrite / use_web_search） */
  rebatchSlotIds: string[];
  /** 是否再跑 planDag（节点有补丁；执行期 seed+闭包，非整图盲重跑） */
  rebatchDag: boolean;
  /** B 打过补丁的 DAG 节点 id（force 根；execute 时扩下游闭包） */
  rebatchDagNodeIds: string[];
  repairs: GlobalRebatchRepair[];
};
