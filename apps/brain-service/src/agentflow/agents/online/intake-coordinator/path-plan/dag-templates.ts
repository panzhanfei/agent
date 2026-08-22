/**
 * DAG 节点合法化：有向依赖图（toolId + deps）。
 * 禁止按业务场景展开 named template。
 */
import {
  TOOL_RUN_IDS,
  defaultDataSourceForStandaloneTool,
  type ExecutionPlanNode,
  type ToolRunId,
} from "@/agentflow/agents/online/tool-orchestrator";
import { legalizeEmptyPolicy } from "./empty-policy";
import type { DagNodeSpec, ExecutionStep, SynthesizeSchema } from "./interface";

export const isExecutableDagStep = (s: ExecutionStep): boolean =>
  s.kind === "dag" && (s.nodes?.length ?? 0) > 0;

const TOOL_ID_SET = new Set<string>(TOOL_RUN_IDS);

const QUERY_TYPES = new Set([
  "identity",
  "enumeration",
  "tech",
  "external_link",
  "relations",
  "default",
]);

export const legalizeSynthesizeSchema = (
  raw: unknown
): SynthesizeSchema => (raw === "match_report" ? "match_report" : "free");

const trimId = (raw: unknown, fallback: string): string => {
  const s = String(raw ?? "").trim();
  return s || fallback;
};

const asToolId = (raw: unknown): ToolRunId | null => {
  const s = String(raw ?? "").trim();
  return TOOL_ID_SET.has(s) ? (s as ToolRunId) : null;
};

const asQueryType = (
  raw: unknown
): DagNodeSpec["queryType"] => {
  const s = String(raw ?? "").trim();
  return QUERY_TYPES.has(s)
    ? (s as NonNullable<DagNodeSpec["queryType"]>)
    : "default";
};

const hasCycle = (nodes: DagNodeSpec[]): boolean => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visiting = new Set<string>();
  const done = new Set<string>();
  const walk = (id: string): boolean => {
    if (done.has(id)) return false;
    if (visiting.has(id)) return true;
    visiting.add(id);
    const n = byId.get(id);
    for (const d of n?.deps ?? []) {
      if (byId.has(d) && walk(d)) return true;
    }
    visiting.delete(id);
    done.add(id);
    return false;
  };
  return nodes.some((n) => walk(n.id));
};

/** 合法化 Intake 写出的 dag.nodes；环 / 无 toolId / 空表 → [] */
export const legalizeDagNodes = (raw: unknown): DagNodeSpec[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const nodes: DagNodeSpec[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const toolId = asToolId(o.toolId ?? o.tool_id);
    if (!toolId) continue;
    const id = trimId(o.id, `n-${i}`);
    if (seen.has(id)) continue;
    seen.add(id);
    const label = String(o.label ?? "").trim() || toolId;
    const searchQuery = String(o.searchQuery ?? o.search_query ?? "").trim();
    const webQuery = String(o.webQuery ?? o.web_query ?? "").trim();
    const deps = Array.isArray(o.deps)
      ? o.deps.map((d) => String(d).trim()).filter(Boolean)
      : [];
    const optionalRaw = o.optionalDeps ?? o.optional_deps;
    const optionalDeps = Array.isArray(optionalRaw)
      ? optionalRaw.map((d) => String(d).trim()).filter(Boolean)
      : undefined;
    nodes.push({
      id,
      label,
      toolId,
      searchQuery: searchQuery || undefined,
      webQuery: webQuery || undefined,
      deps,
      optionalDeps,
      emptyPolicy: legalizeEmptyPolicy(o.emptyPolicy ?? o.empty_policy),
      dataSource: defaultDataSourceForStandaloneTool(toolId),
      queryType: asQueryType(o.queryType ?? o.query_type),
      topics: Array.isArray(o.topics)
        ? o.topics.map((t) => String(t).trim()).filter(Boolean)
        : [],
      targetLang: String(o.targetLang ?? o.target_lang ?? "").trim() || null,
      sourceLang: String(o.sourceLang ?? o.source_lang ?? "").trim() || null,
      synthesizeSchema:
        toolId === "synthesize_merge"
          ? legalizeSynthesizeSchema(
              o.synthesizeSchema ?? o.synthesize_schema
            )
          : undefined,
    });
  }
  const idSet = new Set(nodes.map((n) => n.id));
  const bounded = nodes.map((n) => ({
    ...n,
    deps: (n.deps ?? []).filter((d) => idSet.has(d)),
    optionalDeps: n.optionalDeps?.filter((d) => idSet.has(d)),
  }));
  if (bounded.length === 0 || hasCycle(bounded)) return [];
  return bounded;
};

export const dagNodesToExecutionPlan = (
  nodes: DagNodeSpec[]
): ExecutionPlanNode[] =>
  nodes.map((n) => ({
    id: n.id,
    label: n.label,
    dataSource:
      n.dataSource && n.dataSource !== "mem0" && n.dataSource !== "user_text"
        ? n.dataSource
        : defaultDataSourceForStandaloneTool(n.toolId),
    toolId: n.toolId,
    searchQuery: n.searchQuery,
    webQuery: n.webQuery ?? n.searchQuery,
    queryType: n.queryType,
    topics: n.topics,
    field: null,
    deps: n.deps ?? [],
    optionalDeps: n.optionalDeps,
    emptyPolicy: n.emptyPolicy,
    targetLang: n.targetLang,
    sourceLang: n.sourceLang,
    synthesizeSchema: n.synthesizeSchema,
  }));
