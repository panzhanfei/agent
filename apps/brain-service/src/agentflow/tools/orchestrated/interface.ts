/** 主 pipeline Analyst 编排工具（非 LLM ReAct） */
export const ORCHESTRATED_TOOL_IDS = [
  "compose_enumeration",
  "compute_age_from_hits",
  "compute_tenure_from_hits",
  "extract_identity_from_hits",
  "extract_external_links_from_hits",
  /** 预留：外部事实（公司背景等），Intake external 分支未来接入 */
  "search_web",
] as const;

export type OrchestratedToolId = (typeof ORCHESTRATED_TOOL_IDS)[number];
