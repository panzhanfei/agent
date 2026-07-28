/**
 * Plan fan-out：LangGraph Send 并行工人补丁通道。
 * 每槽 worker → fanOutSlotPatches（append）→ planSlotJoin → fanOutSlotPatch → planSlotPost(post-tools) → planMerge。
 * 注意：本文件不得 import pipeline/graph/state（避免与 Annotation 循环依赖）。
 */
import type {
  ConfidenceTier,
  CompositeSubRetrieval,
  EnumerationMeta,
  IncrementalCompositePlan,
  KnowledgeHit,
  KnowledgeRetrievalResult,
} from "@/agentflow/agents/online/knowledge-manager";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import type {
  PipelineToolResults,
  ToolRunResult,
} from "@/agentflow/agents/online/tool-orchestrator/interface";

/** 单槽工人族（与 PathKind 对齐，供 join 统计） */
export type PlanSlotWorkerKind = "km" | "list" | "mem" | "tool" | "summarize";

/** 单槽工人产出（append 进 fanOutSlotPatches） */
export type PlanSlotWorkerPatch = {
  slotId: string;
  executor: PlanSlotWorkerKind;
  sub: CompositeSubRetrieval;
  stepResult: StepResult;
  error?: string | null;
  /** 本槽 FC 后是否曾局部重检 */
  retried?: boolean;
  /** tool / summarize 工人直接产出的工具结果（join 并入 toolResults） */
  toolResult?: ToolRunResult | null;
};

/** join / post 汇合后的槽位线补丁 */
export type PlanSlotsPatch = {
  hits?: KnowledgeHit[];
  coverage?: KnowledgeRetrievalResult["coverage"];
  notes?: string | null;
  confidenceTier?: ConfidenceTier | null;
  enumerationMeta?: EnumerationMeta | null;
  retrievalCacheHit?: boolean;
  retrievalCacheSlotHits?: number | null;
  compositeSubResults?: CompositeSubRetrieval[] | null;
  compositeIncrementalPlan?: IncrementalCompositePlan | null;
  compositeFacetCacheHits?: number | null;
  checkerPassed?: boolean;
  retryCount?: number;
  error?: string | null;
  slotStepResults?: StepResult[];
  toolResults?: PipelineToolResults | null;
};

/** planDag worker 产出 */
export type PlanDagPatch = {
  hits?: KnowledgeHit[];
  coverage?: KnowledgeRetrievalResult["coverage"];
  notes?: string | null;
  error?: string | null;
  toolResults?: PipelineToolResults | null;
};
