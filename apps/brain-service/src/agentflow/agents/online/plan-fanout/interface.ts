/**
 * Plan fan-out：LangGraph Send 并行工人补丁通道。
 * 每槽 worker → fanOutSlotPatches（append）→ planSlotJoin →（可选全局 B 再批）→ fanOutSlotPatch → planSlotPost → planMerge。
 * 注意：本文件不得 import pipeline/graph/state（避免与 Annotation 循环依赖）。
 */
import type {
  ConfidenceTier,
  CompositeSubRetrieval,
  EnumerationMeta,
  KnowledgeHit,
  KnowledgeRetrievalResult,
} from "@/agentflow/agents/online/knowledge-manager";
import type { IncrementalCompositePlan } from "@/agentflow/cache";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import type {
  PipelineToolResults,
  ToolRunResult,
} from "@/agentflow/agents/online/tool-orchestrator/interface";
import type { SlotRuntimeState } from "@/agentflow/execution";

/** 单槽工人族（与 PathKind 对齐，供 join 统计） */
export type PlanSlotWorkerKind =
  | "km"
  | "list"
  | "mem"
  | "tool"
  | "summarize"
  | "vault_workspace";

/** 单槽工人产出（append 进 fanOutSlotPatches） */
export type PlanSlotWorkerPatch = {
  /** 与 compositeSlots.id / pathPlan.step.id 对齐 */
  slotId: string;
  executor: PlanSlotWorkerKind;
  /** 分槽检索结果（Join 按槽序混排） */
  sub: CompositeSubRetrieval;
  /** 该槽对应的 pathPlan 步结果 */
  stepResult: StepResult;
  /** 工人级失败；Join 见全员 error 则整条槽线失败 */
  error?: string | null;
  /** 遗留字段：工人内 FC 已废，恒为 false */
  retried?: boolean;
  /** tool / summarize 工人直接产出的工具结果（join 并入 toolResults） */
  toolResult?: ToolRunResult | null;
  /** 工人内预算结束后的槽运行时状态 */
  slotRuntime?: SlotRuntimeState | null;
};

/** join / post 汇合后的槽位线补丁 */
export type PlanSlotsPatch = {
  /** 各槽 hits 合并后的扁平列表（Analyst / post 工具用） */
  hits?: KnowledgeHit[];
  coverage?: KnowledgeRetrievalResult["coverage"];
  notes?: string | null;
  confidenceTier?: ConfidenceTier | null;
  enumerationMeta?: EnumerationMeta | null;
  /** 本波所有槽都 hits-cache 命中 */
  retrievalCacheHit?: boolean;
  /** 命中 hits cache 的槽数 */
  retrievalCacheSlotHits?: number | null;
  /** 按槽顺序的分结果（Merge / Analyst 分段用） */
  compositeSubResults?: CompositeSubRetrieval[] | null;
  /** planCacheResolve 写下的全槽缓存计划（Join 原样透传） */
  compositeIncrementalPlan?: IncrementalCompositePlan | null;
  /** 命中 facet 会话缓存的槽数 */
  compositeFacetCacheHits?: number | null;
  /** 工人内 FC 已废；恒 true，仅兼容下游读字段 */
  checkerPassed?: boolean;
  retryCount?: number;
  error?: string | null;
  /** 槽线 stepResults；Merge 再与 dag 步按 answerOrder 混排 */
  slotStepResults?: StepResult[];
  /** 槽工人 + planSlotPost 的工具结果（key 如 slot_<id>） */
  toolResults?: PipelineToolResults | null;
};

/** planDag worker 产出 */
export type PlanDagPatch = {
  hits?: KnowledgeHit[];
  coverage?: KnowledgeRetrievalResult["coverage"];
  notes?: string | null;
  error?: string | null;
  /** 节点 id → ToolRunResult；再批时作 executeDagPlan 的 seed */
  toolResults?: PipelineToolResults | null;
};
