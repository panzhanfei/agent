/**
 * Open-Meteo MCP stdio 入口。仅由 Client spawn，禁止被 barrel import。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { lookupOpenMeteoWeatherText } from "./open-meteo";
import { OPEN_METEO_CURRENT_WEATHER_TOOL } from "./launch";

const server = new McpServer({
  name: "fambrain-open-meteo",
  version: "0.1.0",
});

server.tool(
  OPEN_METEO_CURRENT_WEATHER_TOOL,
  "Current weather for a place name via Open-Meteo (no API key).",
  { location: z.string().min(1).describe("City or place name") },
  async ({ location }) => {
    const result = await lookupOpenMeteoWeatherText(location);
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: !result.ok,
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
