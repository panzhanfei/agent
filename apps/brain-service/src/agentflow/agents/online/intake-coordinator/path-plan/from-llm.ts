/**
 * LLM PathPlan → 合法化 + 派生 compositeSlots / retrievalPlan。
 * 主契约：有序 steps[]；兼容旧四桶 {km,list,tool,dag}+answerOrder。
 * 不做 queryType 猜桶；空 plan → 由上层 clarify。
 */
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import type { EnumerationControl } from "@/agentflow/agents/online/corpus-lister/enumeration";
import { ENUMERATION_EXHAUSTIVE_PAGE_SIZE } from "@/agentflow/agents/online/corpus-lister/list";
import type { DbChatTurn } from "@fambrain/brain-types";
import { resolveEnumerationPagination } from "@/agentflow/agents/online/corpus-lister/enumeration";
import {
  TOOL_RUN_IDS,
  type DataSource,
  type ToolRunId,
} from "@/agentflow/agents/online/tool-orchestrator";
import { expandHybridMultiSourceTemplate } from "./dag-templates";
import { emptyPathPlan, defaultComposeMode } from "./defaults";
import type {
  ComposeMode,
  ExecutionStep,
  PathKind,
  PathPlan,
} from "./interface";

const TOOL_ID_SET = new Set<string>(TOOL_RUN_IDS);

const QUERY_TYPES = new Set([
  "identity",
  "enumeration",
  "tech",
  "external_link",
  "default",
]);

const DATA_SOURCES = new Set(["corpus", "web", "compute", "synthesize"]);
const PATH_KINDS = new Set(["km", "list", "tool", "dag"]);

const asQueryType = (v: unknown): ExecutionStep["queryType"] => {
  if (typeof v === "string" && QUERY_TYPES.has(v)) {
    return v as ExecutionStep["queryType"];
  }
  return "default";
};

const asToolId = (v: unknown): ToolRunId | null => {
  if (typeof v === "string" && TOOL_ID_SET.has(v)) return v as ToolRunId;
  return null;
};

const asDataSource = (v: unknown): DataSource | null => {
  if (typeof v === "string" && DATA_SOURCES.has(v)) return v as DataSource;
  return null;
};

const asKind = (v: unknown): PathKind | null => {
  if (typeof v === "string" && PATH_KINDS.has(v)) return v as PathKind;
  return null;
};

const trimId = (v: unknown, fallback: string): string => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || fallback;
};

export const isPathPlanEmpty = (plan: PathPlan | null | undefined): boolean =>
  !plan || plan.steps.length === 0;

const legalizeEnumerationControl = (
  raw: unknown
): EnumerationControl | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const action = o.action;
  if (
    action !== "preview" &&
    action !== "continue" &&
    action !== "exhaustive"
  ) {
    return null;
  }
  const listKindRaw = String(o.listKind ?? o.list_kind ?? "").trim().toLowerCase();
  let listKind: EnumerationControl["listKind"] | null = null;
  if (listKindRaw === "project" || listKindRaw === "projects") {
    listKind = "project";
  } else if (
    listKindRaw === "experience" ||
    listKindRaw === "employer" ||
    listKindRaw === "employers" ||
    listKindRaw === "company" ||
    listKindRaw === "companies"
  ) {
    listKind = "experience";
  }
  if (!listKind) return null;
  const excludeHint =
    typeof o.excludeHint === "string"
      ? o.excludeHint.trim() || null
      : typeof o.exclude_hint === "string"
        ? o.exclude_hint.trim() || null
        : null;
  let timeWindowYears: number | null = null;
  const tw = o.timeWindowYears ?? o.time_window_years;
  if (typeof tw === "number" && Number.isFinite(tw)) {
    const n = Math.floor(tw);
    if (n > 0 && n <= 50) timeWindowYears = n;
  }
  return { action, listKind, excludeHint, timeWindowYears };
};

const legalizeIdentityField = (
  v: unknown
): ExecutionStep["identityField"] => {
  if (typeof v !== "string") return null;
  const allowed = [
    "name",
    "age",
    "email",
    "phone",
    "education",
    "career",
    "tenure",
  ] as const;
  return (allowed as readonly string[]).includes(v)
    ? (v as (typeof allowed)[number])
    : null;
};

/**
 * external_link 步：若 LLM 漏填 toolId，按 schema 补 extract（非场景硬编码）。
 */
const defaultToolIdForStep = (
  kind: PathKind,
  queryType: ExecutionStep["queryType"],
  identityField: ExecutionStep["identityField"],
  toolId: ToolRunId | null
): ToolRunId | null => {
  if (toolId) return toolId;
  if (kind === "tool") return null;
  if (queryType === "external_link") return "extract_external_links_from_hits";
  if (queryType === "identity" && identityField === "age") {
    return "compute_age_from_hits";
  }
  if (queryType === "identity" && identityField === "tenure") {
    return "compute_tenure_from_hits";
  }
  if (
    queryType === "identity" &&
    (identityField === "name" ||
      identityField === "email" ||
      identityField === "phone" ||
      identityField === "education" ||
      identityField === "career")
  ) {
    return "extract_identity_from_hits";
  }
  if (kind === "list") return "compose_enumeration";
  return null;
};

const legalizeStep = (raw: unknown, index: number): ExecutionStep | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const kind =
    asKind(o.kind ?? o.pathKind ?? o.path_kind) ??
    (o.template === "hybrid_multi_source" ? "dag" : null);
  if (!kind) return null;

  if (kind === "dag") {
    if (o.template !== "hybrid_multi_source") return null;
    return {
      id: trimId(o.id, `dag-${index}`),
      kind: "dag",
      label: String(o.label ?? "多源综合评估").trim() || "多源综合评估",
      searchQuery: String(o.searchQuery ?? o.search_query ?? "").trim() || "多源综合评估",
      queryType: "default",
      topics: Array.isArray(o.topics)
        ? o.topics.map((t) => String(t).trim()).filter(Boolean)
        : [],
      template: "hybrid_multi_source",
      deps: Array.isArray(o.deps)
        ? o.deps.map((d) => String(d).trim()).filter(Boolean)
        : [],
      params:
        o.params && typeof o.params === "object" && !Array.isArray(o.params)
          ? (o.params as Record<string, unknown>)
          : undefined,
    };
  }

  const label = String(o.label ?? "").trim();
  const searchQuery = String(o.searchQuery ?? o.search_query ?? "").trim();
  if (!label && !searchQuery && kind !== "tool") return null;

  const queryType =
    kind === "list" ? "enumeration" : asQueryType(o.queryType ?? o.query_type);
  const topics = Array.isArray(o.topics)
    ? o.topics.map((t) => String(t).trim()).filter(Boolean)
    : kind === "list"
      ? ["project"]
      : [];
  const identityField = legalizeIdentityField(
    o.identityField ?? o.identity_field
  );
  let toolId = asToolId(o.toolId ?? o.tool_id);
  toolId = defaultToolIdForStep(kind, queryType, identityField, toolId);

  if (kind === "tool") {
    if (!toolId) return null;
    const dataSource =
      asDataSource(o.dataSource ?? o.data_source) ??
      (toolId === "search_web" ? "web" : "corpus");
    return {
      id: trimId(o.id, `tool-${index}`),
      kind: "tool",
      label: label || toolId,
      searchQuery: searchQuery || label || toolId,
      queryType,
      topics,
      toolId,
      dataSource,
    };
  }

  if (kind === "list") {
    const enumerationControl = legalizeEnumerationControl(
      o.enumerationControl ?? o.enumeration_control
    );
    return {
      id: trimId(o.id, `list-${index}`),
      kind: "list",
      label: label || searchQuery.slice(0, 40) || `list-${index}`,
      searchQuery: searchQuery || label,
      queryType: "enumeration",
      topics: topics.length > 0 ? topics : ["project"],
      identityField: null,
      toolId: toolId ?? "compose_enumeration",
      dataSource: "corpus",
      enumerationControl,
      enumerationPage:
        typeof o.enumerationPage === "number" ? o.enumerationPage : undefined,
      enumerationPageSize:
        typeof o.enumerationPageSize === "number"
          ? o.enumerationPageSize
          : undefined,
    };
  }

  // km
  const dataSource =
    asDataSource(o.dataSource ?? o.data_source) ??
    (toolId === "compute_age_from_hits" || toolId === "compute_tenure_from_hits"
      ? "compute"
      : "corpus");
  return {
    id: trimId(o.id, `km-${index}`),
    kind: "km",
    label: label || searchQuery.slice(0, 40) || `km-${index}`,
    searchQuery: searchQuery || label,
    queryType,
    topics,
    identityField,
    toolId,
    dataSource,
  };
};

/** 旧四桶 + answerOrder → 有序 steps（兼容过渡） */
const legacyBucketsToSteps = (raw: Record<string, unknown>): unknown[] => {
  const kmIn = Array.isArray(raw.km) ? raw.km : [];
  const listIn = Array.isArray(raw.list) ? raw.list : [];
  const toolIn = Array.isArray(raw.tool) ? raw.tool : [];
  const dagIn = Array.isArray(raw.dag) ? raw.dag : [];
  const byId = new Map<string, unknown>();
  const push = (item: unknown, fallbackKind: PathKind, index: number) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const o = item as Record<string, unknown>;
    const id = trimId(o.id, `${fallbackKind}-${index}`);
    byId.set(id, { ...o, kind: o.kind ?? o.pathKind ?? fallbackKind, id });
  };
  kmIn.forEach((x, i) => push(x, "km", i));
  listIn.forEach((x, i) => push(x, "list", i));
  toolIn.forEach((x, i) => push(x, "tool", i));
  dagIn.forEach((x, i) => push(x, "dag", i));

  const order = Array.isArray(raw.answerOrder)
    ? raw.answerOrder.map((x) => String(x).trim()).filter(Boolean)
    : Array.isArray(raw.answer_order)
      ? raw.answer_order.map((x) => String(x).trim()).filter(Boolean)
      : [];
  const ordered: unknown[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const step = byId.get(id);
    if (step && !seen.has(id)) {
      ordered.push(step);
      seen.add(id);
    }
  }
  for (const [id, step] of byId) {
    if (!seen.has(id)) ordered.push(step);
  }
  return ordered;
};

/** 合法化 LLM pathPlan；支持 steps[] 或旧四桶；非法项丢弃 */
export const legalizePathPlan = (raw: unknown): PathPlan => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyPathPlan();
  }
  const o = raw as Record<string, unknown>;
  let rawSteps: unknown[] = [];
  if (Array.isArray(o.steps) && o.steps.length > 0) {
    rawSteps = o.steps;
  } else if (
    Array.isArray(o.km) ||
    Array.isArray(o.list) ||
    Array.isArray(o.tool) ||
    Array.isArray(o.dag)
  ) {
    rawSteps = legacyBucketsToSteps(o);
  } else if (Array.isArray(o.steps)) {
    rawSteps = o.steps;
  }

  const steps = rawSteps
    .map((item, i) => legalizeStep(item, i))
    .filter((x): x is ExecutionStep => Boolean(x));

  // 去重 id（保留首次）
  const seen = new Set<string>();
  const deduped: ExecutionStep[] = [];
  for (const s of steps) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    deduped.push(s);
  }
  return { steps: deduped };
};

export const legalizeComposeMode = (
  raw: unknown,
  plan: PathPlan
): ComposeMode => {
  if (raw === "qa" || raw === "summarize" || raw === "composite") return raw;
  if (plan.steps.length >= 2) return "composite";
  return defaultComposeMode();
};

/** answerOrder = steps 顺序；若 LLM 另给 order 则校验并重排（合法 id） */
export const legalizeAnswerOrder = (
  raw: unknown,
  plan: PathPlan
): string[] => {
  const allIds = plan.steps.map((s) => s.id);
  const idSet = new Set(allIds);
  const fromLlm = Array.isArray(raw)
    ? raw.map((x) => String(x).trim()).filter((id) => id && idSet.has(id))
    : [];
  if (fromLlm.length === 0) return allIds;
  const missing = allIds.filter((id) => !fromLlm.includes(id));
  return [...fromLlm, ...missing];
};

/** 按 answerOrder 重排 steps（派生前调用） */
export const reorderPathPlanByAnswerOrder = (
  plan: PathPlan,
  answerOrder: string[]
): PathPlan => {
  if (answerOrder.length === 0) return plan;
  const byId = new Map(plan.steps.map((s) => [s.id, s]));
  const ordered: ExecutionStep[] = [];
  const seen = new Set<string>();
  for (const id of answerOrder) {
    const s = byId.get(id);
    if (s && !seen.has(id)) {
      ordered.push(s);
      seen.add(id);
    }
  }
  for (const s of plan.steps) {
    if (!seen.has(s.id)) ordered.push(s);
  }
  return { steps: ordered };
};

/** list 步补页码（从 history assistant blocks，非 Redis） */
export const fillListPagesInPathPlan = (
  plan: PathPlan,
  history: DbChatTurn[]
): PathPlan => {
  const steps = plan.steps.map((step) => {
    if (step.kind !== "list") return step;
    const control = step.enumerationControl;
    if (!control) {
      return {
        ...step,
        enumerationPage: step.enumerationPage ?? 1,
        enumerationPageSize:
          step.enumerationPageSize ?? ENUMERATION_EXHAUSTIVE_PAGE_SIZE,
      };
    }
    const { page, pageSize } = resolveEnumerationPagination(
      control,
      history,
      step.enumerationPageSize ?? ENUMERATION_EXHAUSTIVE_PAGE_SIZE
    );
    return {
      ...step,
      enumerationPage: page,
      enumerationPageSize: pageSize,
    };
  });
  return { steps };
};

/** 按 steps 顺序派生 compositeSlots（dag 不进槽） */
export const deriveCompositeSlotsFromPathPlan = (
  plan: PathPlan,
  _answerOrder?: string[]
): CompositeRetrievalSlot[] => {
  const steps =
    _answerOrder && _answerOrder.length > 0
      ? reorderPathPlanByAnswerOrder(plan, _answerOrder).steps
      : plan.steps;
  const slots: CompositeRetrievalSlot[] = [];
  for (const step of steps) {
    if (step.kind === "dag") continue;
    if (step.kind === "list") {
      const isListAction =
        step.enumerationControl?.action === "continue" ||
        step.enumerationControl?.action === "exhaustive";
      slots.push({
        id: step.id,
        label: step.label,
        searchQuery: step.searchQuery,
        queryType: "enumeration",
        topics: [...step.topics],
        subTasks: [step.label],
        executor: isListAction ? "list_corpus" : "km_retrieve",
        enumerationControl: step.enumerationControl ?? null,
        identityField: null,
        enumerationPage: step.enumerationPage,
        enumerationPageSize: step.enumerationPageSize,
        toolId: step.toolId ?? null,
        dataSource: step.dataSource ?? "corpus",
      });
      continue;
    }
    if (step.kind === "tool") {
      slots.push({
        id: step.id,
        label: step.label,
        searchQuery: step.searchQuery,
        queryType: step.queryType,
        topics: [...step.topics],
        subTasks: [step.label],
        executor: "km_retrieve",
        enumerationControl: null,
        identityField: null,
        toolId: step.toolId ?? null,
        dataSource: step.dataSource ?? "corpus",
      });
      continue;
    }
    slots.push({
      id: step.id,
      label: step.label,
      searchQuery: step.searchQuery,
      queryType: step.queryType,
      topics: [...step.topics],
      subTasks: [step.label],
      executor: "km_retrieve",
      enumerationControl: null,
      identityField: step.identityField ?? null,
      toolId: step.toolId ?? null,
      dataSource: step.dataSource ?? "corpus",
    });
  }
  return slots;
};

export const deriveRetrievalPlanFromPathPlan = (
  plan: PathPlan,
  _answerOrder?: string[]
): IntakeRoutingDecision["retrievalPlan"] => {
  const steps =
    _answerOrder && _answerOrder.length > 0
      ? reorderPathPlanByAnswerOrder(plan, _answerOrder).steps
      : plan.steps;
  const out: IntakeRoutingDecision["retrievalPlan"] = [];
  for (const step of steps) {
    if (step.kind === "dag") continue;
    out.push({
      label: step.label,
      searchQuery: step.searchQuery,
      queryType: step.queryType,
      topics: [...step.topics],
      enumerationControl:
        step.kind === "list" ? (step.enumerationControl ?? null) : null,
      identityField: step.identityField ?? null,
    });
  }
  return out;
};

/** hybrid dag → executionPlan 模板展开 */
export const executionPlanFromPathPlanDag = (
  plan: PathPlan,
  userQuestion: string,
  searchQuery: string
) => {
  const hybrid = plan.steps.find(
    (d) => d.kind === "dag" && d.template === "hybrid_multi_source"
  );
  if (!hybrid) return undefined;
  return expandHybridMultiSourceTemplate(userQuestion, searchQuery);
};
