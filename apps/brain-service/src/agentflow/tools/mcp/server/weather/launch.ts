/**
 * 本 Server 的拉起方式（stdio）。Client 只引用这份 spec，不写天气实现。
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { McpStdioServerSpec } from "@/agentflow/tools/mcp/interface";

const require = createRequire(import.meta.url);

const tsxCli = (): string => {
  const pkgDir = path.dirname(require.resolve("tsx/package.json"));
  return path.join(pkgDir, "dist", "cli.mjs");
};

const stdioEntry = (): string =>
  fileURLToPath(new URL("./stdio.ts", import.meta.url));

export const OPEN_METEO_MCP_SERVER_ID = "open-meteo";

/** 对方进程上的 tool 名（Client 绑定 remoteToolName 用这个常量） */
export const OPEN_METEO_CURRENT_WEATHER_TOOL = "get_current_weather";

export const OPEN_METEO_MCP_STDIO_SERVER: McpStdioServerSpec = {
  id: OPEN_METEO_MCP_SERVER_ID,
  command: process.execPath,
  args: [tsxCli(), stdioEntry()],
};
