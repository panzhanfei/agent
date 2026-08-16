import { runWithToolContext } from "../context";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import { searchWebTool } from "./search-web";

export const runSearchWeb = async (input: {
  corpusUserId: string;
  actorUserId: string;
  query: string;
}): Promise<ToolRunResult> => {
  const raw = await runWithToolContext(
    { corpusUserId: input.corpusUserId, actorUserId: input.actorUserId },
    () => searchWebTool.invoke({ query: input.query })
  );
  const parsed = JSON.parse(String(raw)) as {
    status: string;
    query: string;
    results?: Array<{ title: string; url: string; snippet: string }>;
    message?: string;
  };
  const snippets = parsed.results ?? [];
  const ok = parsed.status === "ok" && snippets.length > 0;
  const answer = ok
    ? snippets
        .slice(0, 5)
        .map((s, i) => `${i + 1}. ${s.title}：${s.snippet}`)
        .join("\n")
    : parsed.message ??
      "未配置联网搜索或暂无外部检索结果，请补充语料或配置 TAVILY_API_KEY。";
  return {
    toolId: "search_web",
    label: input.query,
    ok,
    answer,
    citations: snippets.map((s) => ({
      path: s.url,
      excerpt: s.snippet,
    })),
    hits: [],
    insufficientEvidence: !ok,
    confidence: ok ? 0.7 : 0.85,
    webSnippets: snippets,
  };
};
