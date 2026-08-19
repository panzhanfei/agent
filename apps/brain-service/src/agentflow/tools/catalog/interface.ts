import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";

/**
 * 主 pipeline 可执行 toolId。扩展天气等：在此加 id + catalog 清单 + invoke 分发。
 * 不在 PostRetrievalToolId 内的 → 自动走 toolRetrieve Send。
 */
export type ToolRunId =
  | "retrieve_corpus"
  | "list_corpus_entries"
  | "compute_age_from_hits"
  | "compute_tenure_from_hits"
  | "extract_identity_from_hits"
  | "extract_external_links_from_hits"
  | "compose_enumeration"
  | "search_web"
  | "translate_text"
  | "synthesize_merge";

/** 需先有 corpus/list hits 再跑的工具（planSlotPost） */
export type PostRetrievalToolId =
  | "retrieve_corpus"
  | "list_corpus_entries"
  | "compute_age_from_hits"
  | "compute_tenure_from_hits"
  | "extract_identity_from_hits"
  | "extract_external_links_from_hits"
  | "compose_enumeration";

/** Analyst 无 plan 节点时，可按 queryType / identityField 兜底的子集 */
export type AnalystFallbackToolId =
  | "compose_enumeration"
  | "compute_age_from_hits"
  | "compute_tenure_from_hits"
  | "extract_identity_from_hits"
  | "extract_external_links_from_hits"
  | "search_web"
  | "translate_text";

/** LangChain StructuredTool 适配器名（实验 / bindTools；主路径不走 ReAct） */
export type LangchainToolName =
  | "retrieve_corpus"
  | "compute_age_from_hits"
  | "remember_user_fact"
  | "recall_user_fact"
  | "list_vault_files"
  | "summarize_text"
  | "search_web"
  | "translate_text"
  | "get_current_date";

/** 实现所在 tools/ 子目录（一工具一入口，供盘点；invoke 按 toolId 调 run*） */
export type PipelineToolFolder =
  | "corpus"
  | "enumeration"
  | "identity"
  | "links"
  | "web"
  | "translate"
  | "synthesize";

/** 声明式 identity 字段 → 工具映射（由 Intake identityField 索引） */
export type IdentityFieldSpec = {
  id: IntakeIdentityField;
  toolId: ToolRunId | null;
  requiresCompute: boolean;
};
