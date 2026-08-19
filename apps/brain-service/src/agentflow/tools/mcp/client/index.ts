/**
 * 生产路径 MCP Client：只调已登记绑定，不把 tools/list 交给模型。
 * Server 实现在 mcp/server；这里只登记怎么连、调哪个远程 tool。
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ToolRunId } from "@/agentflow/tools/catalog/interface";
import {
  OPEN_METEO_CURRENT_WEATHER_TOOL,
  OPEN_METEO_MCP_SERVER_ID,
  OPEN_METEO_MCP_STDIO_SERVER,
} from "@/agentflow/tools/mcp/server";
import type {
  McpClientBinding,
  McpStdioServerSpec,
  McpToolCallResult,
} from "./interface";

export type {
  McpClientBinding,
  McpStdioServerSpec,
  McpToolCallResult,
} from "./interface";

/** 已登记的 MCP Server。接入时加条目，不要运行时发现。 */
export const MCP_CLIENT_SERVERS: readonly McpStdioServerSpec[] = [
  OPEN_METEO_MCP_STDIO_SERVER,
];

/** 我们的 toolId → 对方 Server 上的 tool 名。 */
export const MCP_CLIENT_BINDINGS: readonly McpClientBinding[] = [
  {
    toolId: "get_weather",
    serverId: OPEN_METEO_MCP_SERVER_ID,
    remoteToolName: OPEN_METEO_CURRENT_WEATHER_TOOL,
  },
];

export const resolveMcpClientBinding = (
  toolId: ToolRunId
): McpClientBinding | null =>
  MCP_CLIENT_BINDINGS.find((b) => b.toolId === toolId) ?? null;

const textFromCallResult = (result: {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  toolResult?: unknown;
}): string => {
  const texts = (result.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text ?? "");
  if (texts.length > 0) return texts.join("\n");
  if (result.structuredContent) {
    return JSON.stringify(result.structuredContent);
  }
  if (result.toolResult !== undefined) {
    return typeof result.toolResult === "string"
      ? result.toolResult
      : JSON.stringify(result.toolResult);
  }
  return "";
};

export const callRegisteredMcpTool = async (input: {
  toolId: ToolRunId;
  arguments: Record<string, unknown>;
}): Promise<McpToolCallResult> => {
  const binding = resolveMcpClientBinding(input.toolId);
  if (!binding) {
    return { ok: false, text: `未登记 MCP 绑定：${input.toolId}` };
  }
  const server = MCP_CLIENT_SERVERS.find((s) => s.id === binding.serverId);
  if (!server) {
    return { ok: false, text: `未登记 MCP Server：${binding.serverId}` };
  }

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args ? [...server.args] : [],
    cwd: server.cwd,
    env,
    stderr: "ignore",
  });
  const client = new Client({
    name: "fambrain-invoke",
    version: "0.1.0",
  });
  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: binding.remoteToolName,
      arguments: input.arguments,
    });
    return {
      ok: result.isError !== true,
      text: textFromCallResult(result),
    };
  } catch (e) {
    return {
      ok: false,
      text: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await client.close().catch(() => undefined);
  }
};
