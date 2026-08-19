/**
 * 本进程对外 MCP Server：stdio 实现在子目录；禁止把 tools/list 交给对话模型。
 * Client 只引用 launch spec + 绑定表。stdio 入口禁止被本 barrel import。
 */
export type { McpServerExportName } from "./interface";
export {
  OPEN_METEO_CURRENT_WEATHER_TOOL,
  OPEN_METEO_MCP_SERVER_ID,
  OPEN_METEO_MCP_STDIO_SERVER,
  formatOpenMeteoAnswer,
  lookupOpenMeteoWeatherText,
  wmoWeatherLabelZh,
} from "./weather";
export type { OpenMeteoCurrent, OpenMeteoPlace } from "./weather";

/** 本 Server 允许被点的远程 tool 名（与 catalog toolId 不是同一张表） */
export const MCP_SERVER_EXPORTS = [
  "get_current_weather",
] as const satisfies readonly string[];
