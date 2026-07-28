/**
 * Plan fan-out：LangGraph Send 并行工人补丁通道。
 * 各 worker 写入专用字段，planMerge 再汇合到 hits / stepResults / toolResults。
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
import type { PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/types";

/** km 槽路径补丁（检索后可由 planSlotPost 补齐 FC/tools） */
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
