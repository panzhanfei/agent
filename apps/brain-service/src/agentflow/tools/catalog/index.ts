/**
 * 工具清单：本地、外调 HTTP、MCP 对外，都在此登记。
 * 生产执行走 `@/agentflow/tools/invoke`。
 */
import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import type {
  AnalystFallbackToolId,
  IdentityFieldSpec,
  LangchainToolName,
  PipelineToolFolder,
  PostRetrievalToolId,
  ToolRunId,
  ToolTransport,
} from "./interface";

export type {
  AnalystFallbackToolId,
  IdentityFieldSpec,
  LangchainToolName,
  PipelineToolFolder,
  PostRetrievalToolId,
  ToolRunId,
  ToolTransport,
} from "./interface";

export const TOOL_RUN_IDS = [
  "retrieve_corpus",
  "list_corpus_entries",
  "compute_age_from_hits",
  "compute_tenure_from_hits",
  "extract_identity_from_hits",
  "extract_external_links_from_hits",
  "compose_enumeration",
  "search_web",
  "translate_text",
  "synthesize_merge",
  "get_weather",
] as const satisfies readonly ToolRunId[];

export const POST_RETRIEVAL_TOOL_IDS = [
  "retrieve_corpus",
  "list_corpus_entries",
  "compute_age_from_hits",
  "compute_tenure_from_hits",
  "extract_identity_from_hits",
  "extract_external_links_from_hits",
  "compose_enumeration",
] as const satisfies readonly PostRetrievalToolId[];

export const ANALYST_FALLBACK_TOOL_IDS = [
  "compose_enumeration",
  "compute_age_from_hits",
  "compute_tenure_from_hits",
  "extract_identity_from_hits",
  "extract_external_links_from_hits",
  "search_web",
  "translate_text",
] as const satisfies readonly AnalystFallbackToolId[];

/** LangChain 适配器名；主 pipeline 仍走 invoke(toolId) */
export const LANGCHAIN_TOOL_NAMES = [
  "retrieve_corpus",
  "compute_age_from_hits",
  "remember_user_fact",
  "recall_user_fact",
  "list_vault_files",
  "summarize_text",
  "search_web",
  "translate_text",
  "get_current_date",
] as const satisfies readonly LangchainToolName[];

/** @deprecated 用 LANGCHAIN_TOOL_NAMES */
export const FAMBRAIN_TOOL_NAMES = LANGCHAIN_TOOL_NAMES;

/**
 * 每个 pipeline toolId → 实现目录。新增工具：先登记这里，再写 run*，再进 invoke。
 */
export const PIPELINE_TOOL_IMPL = {
  retrieve_corpus: "corpus",
  list_corpus_entries: "enumeration",
  compute_age_from_hits: "identity",
  compute_tenure_from_hits: "identity",
  extract_identity_from_hits: "identity",
  extract_external_links_from_hits: "links",
  compose_enumeration: "enumeration",
  search_web: "web",
  translate_text: "translate",
  synthesize_merge: "synthesize",
  get_weather: "weather",
} as const satisfies Record<ToolRunId, PipelineToolFolder>;

/** 每个 pipeline toolId 的运输层。mcp 须同时在 mcp/client 登记绑定。 */
export const PIPELINE_TOOL_TRANSPORT: Record<ToolRunId, ToolTransport> = {
  retrieve_corpus: "local",
  list_corpus_entries: "local",
  compute_age_from_hits: "local",
  compute_tenure_from_hits: "local",
  extract_identity_from_hits: "local",
  extract_external_links_from_hits: "local",
  compose_enumeration: "local",
  search_web: "http",
  translate_text: "http",
  synthesize_merge: "local",
  get_weather: "mcp",
};

export const IDENTITY_FIELD_BY_ID: Record<
  IntakeIdentityField,
  IdentityFieldSpec
> = {
  age: {
    id: "age",
    toolId: "compute_age_from_hits",
    requiresCompute: true,
  },
  birthYear: {
    id: "birthYear",
    toolId: "extract_identity_from_hits",
    requiresCompute: false,
  },
  name: {
    id: "name",
    toolId: "extract_identity_from_hits",
    requiresCompute: false,
  },
  education: {
    id: "education",
    toolId: null,
    requiresCompute: false,
  },
  career: {
    id: "career",
    toolId: null,
    requiresCompute: false,
  },
  tenure: {
    id: "tenure",
    toolId: "compute_tenure_from_hits",
    requiresCompute: true,
  },
  email: {
    id: "email",
    toolId: null,
    requiresCompute: false,
  },
  phone: {
    id: "phone",
    toolId: null,
    requiresCompute: false,
  },
};

export const isPostRetrievalToolId = (
  toolId: ToolRunId | null | undefined
): toolId is PostRetrievalToolId =>
  Boolean(
    toolId && (POST_RETRIEVAL_TOOL_IDS as readonly string[]).includes(toolId)
  );

export const resolveIdentityFieldFromPlan = (input: {
  identityField?: IntakeIdentityField | null;
}): IdentityFieldSpec | null => {
  const id = input.identityField ?? null;
  if (!id) return null;
  return IDENTITY_FIELD_BY_ID[id] ?? null;
};

/**
 * @deprecated 改用 resolveIdentityFieldFromPlan({ identityField })。
 */
export const resolveIdentityField = (
  _label: string,
  identityField?: IntakeIdentityField | null
): IdentityFieldSpec | null =>
  resolveIdentityFieldFromPlan({ identityField });
