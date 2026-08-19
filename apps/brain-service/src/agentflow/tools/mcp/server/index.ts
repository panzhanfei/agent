/**
 * 待定：把 invoke 允许对外的 toolId 暴露为 MCP Server。
 * 现在的 `experiment:mcp-vault` 以后搬到这里，不另建第三份 tool 清单。
 */
export type { McpServerExportName } from "./interface";

export const MCP_SERVER_EXPORTS: readonly string[] = [];
