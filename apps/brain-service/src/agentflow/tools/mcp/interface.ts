import type { ToolRunId } from "@/agentflow/tools/catalog/interface";

/** 外部 MCP Server（stdio）。禁止把 tools/list 塞给对话模型。 */
export type McpStdioServerSpec = {
  id: string;
  command: string;
  args?: string[];
  cwd?: string;
};

/** 固定登记：我们的 toolId → 对方 Server 上的 tool 名 */
export type McpClientBinding = {
  toolId: ToolRunId;
  serverId: string;
  remoteToolName: string;
};

export type McpToolCallResult = {
  ok: boolean;
  text: string;
};

/** 对外 MCP Server 允许被点的名字。待定；当前实验脚本未迁入。 */
export type McpServerExportName = string;
