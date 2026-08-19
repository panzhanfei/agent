import type { EnumerationListIntent } from "@/agentflow/agents/online/intake-coordinator/guards/interface";
import type {
  EnumerationMeta,
  KnowledgeHit,
} from "@/agentflow/agents/online/knowledge-manager";
import type {
  ExecutionPlanNode,
  PipelineToolResults,
  ToolRunResult,
} from "@/agentflow/agents/online/tool-orchestrator/interface";

export type InvokeToolContext = {
  corpusUserId: string;
  actorUserId: string;
  userQuestion: string;
  asOfDate: string;
  language: "zh" | "en" | "mixed";
  hits: KnowledgeHit[];
  prior: PipelineToolResults;
  notes?: string | null;
  enumerationMeta?: EnumerationMeta | null;
  listIntent?: EnumerationListIntent | null;
  decisionTopics?: string[];
  parentUserQuestion?: string;
};

export type { ExecutionPlanNode, ToolRunResult };
