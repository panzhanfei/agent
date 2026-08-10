/**
 * LLM PathPlan → 合法化 + 结构归一 + 派生 compositeSlots / retrievalPlan。
 * 主契约：有序 steps[]。
 * normalizePathPlanSteps：仅按 dataSource / userFactKey / identityField / toolId 族修正 kind（无字段名表）。
 */
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import type { EnumerationControl } from "@/agentflow/agents/online/corpus-lister/enumeration";
import type { SlotExecutor } from "@/agentflow/agents/online/corpus-lister/enumeration";
import {
  ENUMERATION_EXHAUSTIVE_PAGE_SIZE,
  ENUMERATION_PREVIEW_PAGE_SIZE,
} from "@/agentflow/agents/online/corpus-lister/list";
import type { DbChatTurn } from "@fambrain/brain-types";
import { resolveEnumerationPagination } from "@/agentflow/agents/online/corpus-lister/enumeration";
import { normalizeFactKey } from "@/agentflow/agents/online/user-fact/user-fact";
import {
  TOOL_RUN_IDS,
  defaultDataSourceForStandaloneTool,
  isPostRetrievalToolId,
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

const DATA_SOURCES = new Set([
  "corpus",
  "web",
  "compute",
  "synthesize",
  "mem0",
  "user_text",
]);
const PATH_KINDS = new Set([
  "km",
  "list",
  "mem",
  "tool",
  "summarize",
  "dag",
  "vault_workspace",
  "corpus_edit",
]);

const VAULT_WORKSPACE_OPS = new Set([
  "list",
  "open",
  "create_file",
  "create_folder",
  "update",
  "delete_file",
  "delete_folder",
]);

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
  const listKindRaw = String(o.listKind ?? o.list_kind ?? "")
    .trim()
    .toLowerCase();
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

const legalizeIdentityField = (v: unknown): ExecutionStep["identityField"] => {
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

const legalizeUserFactKey = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const key = normalizeFactKey(v);
  return key || null;
};

/**
 * external_link / identity 步：若 LLM 漏填 toolId，按 schema 补（非场景硬编码）。
 */
const defaultToolIdForStep = (
  kind: PathKind,
  queryType: ExecutionStep["queryType"],
  identityField: ExecutionStep["identityField"],
  toolId: ToolRunId | null
): ToolRunId | null => {
  if (toolId) return toolId;
  if (
    kind === "tool" ||
    kind === "mem" ||
    kind === "summarize" ||
    kind === "dag" ||
    kind === "corpus_edit" ||
    kind === "vault_workspace"
  ) {
    return null;
  }
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

const toMemStep = (step: ExecutionStep): ExecutionStep => {
  const key = legalizeUserFactKey(step.userFactKey);
  return {
    id: step.id,
    kind: "mem",
    label: step.label,
    searchQuery: step.searchQuery || step.label,
    queryType: step.queryType === "enumeration" ? "default" : step.queryType,
    topics: step.topics.length > 0 ? step.topics : ["personal"],
    identityField: null,
    toolId: null,
    dataSource: "mem0",
    userFactKey: key,
    userFactLabel: step.userFactLabel?.trim() || step.label || key,
    enumerationControl: null,
  };
};

const toSummarizeStep = (step: ExecutionStep): ExecutionStep => ({
  id: step.id,
  kind: "summarize",
  label: step.label,
  searchQuery: step.searchQuery || step.label,
  queryType: "default",
  topics: step.topics,
  identityField: null,
  toolId: null,
  dataSource: "user_text",
  userFactKey: null,
  userFactLabel: null,
  enumerationControl: null,
});

const toToolStep = (step: ExecutionStep): ExecutionStep | null => {
  if (!step.toolId) return null;
  return {
    id: step.id,
    kind: "tool",
    label: step.label || step.toolId,
    searchQuery: step.searchQuery || step.label || step.toolId,
    queryType: step.queryType,
    topics: step.topics,
    identityField: null,
    toolId: step.toolId,
    dataSource:
      step.dataSource && step.dataSource !== "mem0" && step.dataSource !== "user_text"
        ? step.dataSource
        : defaultDataSourceForStandaloneTool(step.toolId),
    userFactKey: null,
    userFactLabel: null,
    enumerationControl: null,
  };
};

/**
 * 结构归一：只信 dataSource / userFactKey / identityField / toolId 族。
 * 不维护 Mem0 字段名表；不猜 label/问句。
 */
export const normalizePathPlanSteps = (plan: PathPlan): PathPlan => {
  const steps: ExecutionStep[] = [];
  for (const raw of plan.steps) {
    let s = raw;

    // 显式 mem0 / kind=mem
    if (s.dataSource === "mem0" || s.kind === "mem") {
      const memKey = legalizeUserFactKey(s.userFactKey);
      // 误标 dataSource=mem0 但无 userFactKey → 回落语料 km（禁止空 key mem / 误走 Mem0）
      if (!memKey && s.kind !== "mem") {
        steps.push({
          ...s,
          kind: "km",
          dataSource: "corpus",
          userFactKey: null,
          userFactLabel: null,
          toolId: isPostRetrievalToolId(s.toolId) ? s.toolId : null,
        });
        continue;
      }
      steps.push(toMemStep(s));
      continue;
    }

    // 显式 user_text / kind=summarize
    if (s.dataSource === "user_text" || s.kind === "summarize") {
      steps.push(toSummarizeStep(s));
      continue;
    }

    const factKey = legalizeUserFactKey(s.userFactKey);
    const hasIdentity = Boolean(s.identityField);

    // userFactKey 有、identityField 无 → mem（补 dataSource=mem0）
    if (factKey && !hasIdentity) {
      steps.push(toMemStep({ ...s, userFactKey: factKey }));
      continue;
    }

    // 两者皆有：缺省走语料 identity（闭集）；mem0 已在上方分支处理
    if (factKey && hasIdentity) {
      s = {
        ...s,
        kind: "km",
        userFactKey: null,
        userFactLabel: null,
        dataSource:
          s.dataSource === "compute" || s.dataSource === "corpus"
            ? s.dataSource
            : "corpus",
      };
    }

    // 独立工具（非 post-retrieval）
    const standaloneTool =
      s.toolId &&
      !isPostRetrievalToolId(s.toolId) &&
      s.toolId !== "synthesize_merge";
    if (s.kind === "tool" || (standaloneTool && (s.dataSource === "web" || s.kind === "km"))) {
      if (standaloneTool && s.toolId) {
        const tool = toToolStep({ ...s, toolId: s.toolId });
        if (tool) {
          steps.push(tool);
          continue;
        }
      }
    }

    // dag / list / vault_workspace / corpus_edit / km 保持
    if (
      s.kind === "dag" ||
      s.kind === "list" ||
      s.kind === "vault_workspace" ||
      s.kind === "corpus_edit"
    ) {
      steps.push(s);
      continue;
    }

    steps.push({
      ...s,
      kind: "km",
      dataSource:
        s.dataSource === "compute" || s.dataSource === "corpus"
          ? s.dataSource
          : s.toolId === "compute_age_from_hits" ||
              s.toolId === "compute_tenure_from_hits"
            ? "compute"
            : "corpus",
      userFactKey: null,
      userFactLabel: null,
    });
  }
  return { steps };
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
      searchQuery:
        String(o.searchQuery ?? o.search_query ?? "").trim() || "多源综合评估",
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
  let searchQuery = String(o.searchQuery ?? o.search_query ?? "").trim();
  if (!label && !searchQuery && kind !== "tool") return null;

  let queryType =
    kind === "list" ? "enumeration" : asQueryType(o.queryType ?? o.query_type);
  const topics = Array.isArray(o.topics)
    ? o.topics.map((t) => String(t).trim()).filter(Boolean)
    : kind === "list"
      ? ["project"]
      : [];
  const rawIdentityField = o.identityField ?? o.identity_field;
  let identityField = legalizeIdentityField(rawIdentityField);
  let userFactKey = legalizeUserFactKey(o.userFactKey ?? o.user_fact_key);
  /**
   * LLM 偶发把 Mem0 开集 slug（全小写 ascii，如 qq）误写入 identityField：
   * → 抬升为 userFactKey 走 mem。camelCase 发明字段（sisterInLawName）仍走亲友语料回落。
   */
  if (
    typeof rawIdentityField === "string" &&
    rawIdentityField.trim() &&
    !identityField
  ) {
    const rawId = rawIdentityField.trim();
    const asMemKey = legalizeUserFactKey(rawId);
    const looksOpenFactSlug =
      Boolean(asMemKey) &&
      !/[A-Z]/.test(rawId) &&
      asMemKey === rawId.toLowerCase().replace(/[^a-z0-9_+-]/g, "");
    if (looksOpenFactSlug && asMemKey) {
      if (!userFactKey) userFactKey = asMemKey;
    } else {
      if (queryType === "identity") queryType = "default";
      if (label && !/亲友/.test(searchQuery)) {
        searchQuery = `亲友关系 ${label}`;
      }
    }
  }
  const userFactLabelRaw = o.userFactLabel ?? o.user_fact_label;
  const userFactLabel =
    typeof userFactLabelRaw === "string" ? userFactLabelRaw.trim() || null : null;
  // 结构信号：topics 含 family → 非本人 identity；searchQuery 须落亲友语料
  const topicFamily = topics.some((t) => t.toLowerCase() === "family");
  if (topicFamily) {
    if (identityField) identityField = null;
    if (queryType === "identity") queryType = "default";
    if (label && !/亲友/.test(searchQuery)) {
      searchQuery = `亲友关系 ${label}`;
    }
  }
  const rawToolId = asToolId(o.toolId ?? o.tool_id);
  let toolId = rawToolId;
  toolId = defaultToolIdForStep(kind, queryType, identityField, toolId);
  // schema：extract_identity_* 必须挂合法 identityField；非法字段被剥掉后勿残留 toolId
  if (
    (toolId === "extract_identity_from_hits" ||
      toolId === "compute_age_from_hits" ||
      toolId === "compute_tenure_from_hits") &&
    !identityField
  ) {
    toolId = null;
  }
  const dataSourceRaw = asDataSource(o.dataSource ?? o.data_source);
  const dataSourceHint = String(o.dataSource ?? o.data_source ?? "")
    .trim()
    .toLowerCase();

  /**
   * LLM 偶发把 Mem0 槽写成 km-<slug>（如 km-qq）且未填 userFactKey/identityField：
   * 仅在非亲友、且 slug 不属于 identity 闭集时，从 step.id 抬升为 mem。
   * 信号：step.id / 原 toolId=extract_identity / dataSource 暗示 memory。
   */
  const rawIdentityAbsent =
    rawIdentityField == null ||
    (typeof rawIdentityField === "string" && !rawIdentityField.trim());
  if (
    !userFactKey &&
    !identityField &&
    !topicFamily &&
    rawIdentityAbsent &&
    (kind === "km" || kind === "mem")
  ) {
    const stepId = String(o.id ?? "").trim();
    const idSlug = stepId
      .match(/^(?:km|mem)[-_]?([a-z][a-z0-9_+-]{0,63})$/i)?.[1]
      ?.toLowerCase();
    if (
      idSlug &&
      !legalizeIdentityField(idSlug) &&
      legalizeUserFactKey(idSlug) === idSlug
    ) {
      const hintsMem =
        kind === "mem" ||
        rawToolId === "extract_identity_from_hits" ||
        dataSourceHint === "mem0" ||
        dataSourceHint === "memory" ||
        queryType === "identity";
      if (hintsMem) {
        userFactKey = idSlug;
      }
    }
  }

  // km/mem + userFactKey 且无闭集 identity → mem（含 identityField=qq 抬升）
  if (userFactKey && !identityField && (kind === "mem" || kind === "km")) {
    return {
      id: trimId(o.id, `mem-${index}`),
      kind: "mem",
      label: label || searchQuery.slice(0, 40) || `mem-${index}`,
      searchQuery: searchQuery || label,
      queryType: queryType === "enumeration" ? "default" : queryType,
      topics: topics.length > 0 ? topics : ["personal"],
      identityField: null,
      toolId: null,
      dataSource: "mem0",
      userFactKey,
      userFactLabel: userFactLabel || label || userFactKey,
    };
  }

  if (kind === "summarize") {
    return {
      id: trimId(o.id, `summarize-${index}`),
      kind: "summarize",
      label: label || searchQuery.slice(0, 40) || `summarize-${index}`,
      searchQuery: searchQuery || label,
      queryType: "default",
      topics,
      identityField: null,
      toolId: null,
      dataSource: "user_text",
      userFactKey: null,
      userFactLabel: null,
    };
  }

  if (kind === "tool") {
    if (!toolId) return null;
    const dataSource =
      dataSourceRaw && dataSourceRaw !== "mem0" && dataSourceRaw !== "user_text"
        ? dataSourceRaw
        : defaultDataSourceForStandaloneTool(toolId);
    const targetLang =
      String(o.targetLang ?? o.target_lang ?? "").trim() || null;
    const sourceLang =
      String(o.sourceLang ?? o.source_lang ?? "").trim() || null;
    return {
      id: trimId(o.id, `tool-${index}`),
      kind: "tool",
      label: label || toolId,
      searchQuery: searchQuery || label || toolId,
      queryType,
      topics,
      toolId,
      dataSource,
      targetLang,
      sourceLang,
      userFactKey: null,
      userFactLabel: null,
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
      userFactKey: null,
      userFactLabel: null,
      enumerationControl,
      enumerationPage:
        typeof o.enumerationPage === "number" ? o.enumerationPage : undefined,
      enumerationPageSize:
        typeof o.enumerationPageSize === "number"
          ? o.enumerationPageSize
          : undefined,
    };
  }

  // 直接改 corpus md 已退役：丢弃（引导走 vault_workspace）
  if (kind === "corpus_edit") {
    return null;
  }

  if (kind === "vault_workspace") {
    const params =
      o.params && typeof o.params === "object" && !Array.isArray(o.params)
        ? (o.params as Record<string, unknown>)
        : {};
    let operation = String(params.operation ?? params.op ?? "list")
      .trim()
      .toLowerCase();
    if (!VAULT_WORKSPACE_OPS.has(operation)) {
      operation = "list";
    }
    const targetPath = String(
      params.targetPath ?? params.target_path ?? searchQuery ?? ""
    ).trim();
    // list 允许空 path（根）；其它 op 除 create_* 外须有 path；create_* 可用 folder path 或根
    if (
      operation !== "list" &&
      operation !== "create_file" &&
      operation !== "create_folder" &&
      !targetPath
    ) {
      return null;
    }
    // create_folder 无 name → 丢弃（create_file 工人可默认 untitled）
    if (
      operation === "create_folder" &&
      !String(params.name ?? "").trim()
    ) {
      return null;
    }
    const afterContent =
      typeof params.afterContent === "string"
        ? params.afterContent
        : typeof params.after_content === "string"
          ? params.after_content
          : "";
    if (operation === "update" && !afterContent.trim()) {
      operation = "open";
    }
    const name =
      typeof params.name === "string" ? params.name.trim() : null;
    return {
      id: trimId(o.id, `vault-ws-${index}`),
      kind: "vault_workspace",
      label: label || "原文库",
      searchQuery: targetPath,
      queryType: "default",
      topics: topics.length > 0 ? topics : ["personal"],
      identityField: null,
      toolId: null,
      dataSource: "corpus",
      userFactKey: null,
      userFactLabel: null,
      params: {
        ...params,
        targetPath,
        operation,
        afterContent,
        ...(name ? { name } : {}),
      },
    };
  }

  // km（含 LLM 误写 kind 但带 mem 信号的情况，交给 normalize）
  const dataSource =
    dataSourceRaw ??
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
    userFactKey,
    userFactLabel,
  };
};

/** 合法化 LLM pathPlan；非法项丢弃；再结构归一 */
export const legalizePathPlan = (raw: unknown): PathPlan => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyPathPlan();
  }
  const o = raw as Record<string, unknown>;
  const rawSteps = Array.isArray(o.steps) ? o.steps : [];

  const steps = rawSteps
    .map((item, i) => legalizeStep(item, i))
    .filter((x): x is ExecutionStep => Boolean(x));

  const seen = new Set<string>();
  const deduped: ExecutionStep[] = [];
  for (const s of steps) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    deduped.push(s);
  }
  return normalizePathPlanSteps({ steps: deduped });
};

export const legalizeComposeMode = (
  raw: unknown,
  plan: PathPlan
): ComposeMode => {
  if (raw === "qa" || raw === "summarize" || raw === "composite") return raw;
  if (plan.steps.length >= 2) return "composite";
  return defaultComposeMode();
};

/**
 * 复合 retrieve 时 LLM 有时在顶层填 userFactKey（无 Value = recall），却漏写 kind=mem 步。
 * 按结构化顶层 key 补一步 mem recall（非口语猜意图）；remember side-effect（有 Value）不补。
 */
export const ensureMemRecallStepFromTopUserFact = (
  decision: Pick<
    IntakeRoutingDecision,
    "intent" | "userFactKey" | "userFactLabel" | "userFactValue"
  >,
  plan: PathPlan
): PathPlan => {
  if (decision.intent !== "retrieve_and_answer") return plan;
  const factKey = normalizeFactKey(decision.userFactKey ?? "");
  if (!factKey || decision.userFactValue?.trim()) return plan;
  if (plan.steps.length === 0) return plan;

  const hasMem = plan.steps.some(
    (s) =>
      s.kind === "mem" &&
      normalizeFactKey(s.userFactKey ?? "") === factKey
  );
  if (hasMem) return plan;

  const label = decision.userFactLabel?.trim() || factKey;
  const memStep: ExecutionStep = {
    id: `mem-${factKey}`,
    kind: "mem",
    label,
    searchQuery: label,
    queryType: "identity",
    topics: ["personal"],
    identityField: null,
    toolId: null,
    dataSource: "mem0",
    userFactKey: factKey,
    userFactLabel: label,
    enumerationControl: null,
  };

  const ageIdx = plan.steps.findIndex(
    (s) => s.identityField === "age" || s.id === "km-age"
  );
  const insertIdx =
    ageIdx >= 0 ? ageIdx + 1 : Math.min(1, plan.steps.length);
  const steps = [...plan.steps];
  steps.splice(insertIdx, 0, memStep);
  return { steps };
};

/** answerOrder = steps 顺序；若 LLM 另给 order 则校验并重排（合法 id） */
export const legalizeAnswerOrder = (raw: unknown, plan: PathPlan): string[] => {
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
          step.enumerationPageSize ?? ENUMERATION_PREVIEW_PAGE_SIZE,
      };
    }
    const defaultPageSize =
      control.action === "preview"
        ? ENUMERATION_PREVIEW_PAGE_SIZE
        : ENUMERATION_EXHAUSTIVE_PAGE_SIZE;
    const { page, pageSize } = resolveEnumerationPagination(
      control,
      history,
      step.enumerationPageSize ?? defaultPageSize
    );
    return {
      ...step,
      enumerationPage: page,
      enumerationPageSize: pageSize,
    };
  });
  return { steps };
};

const executorForStep = (step: ExecutionStep): SlotExecutor => {
  if (step.kind === "list" || step.queryType === "enumeration") {
    return "list_corpus";
  }
  switch (step.kind) {
    case "mem":
      return "mem_recall";
    case "tool":
      return "tool_run";
    case "summarize":
      return "summarize_slot";
    case "vault_workspace":
      return "vault_workspace";
    case "corpus_edit":
      return "corpus_edit";
    default:
      return "km_retrieve";
  }
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
    const executor = executorForStep(step);
    slots.push({
      id: step.id,
      label: step.label,
      searchQuery: step.searchQuery,
      queryType: step.kind === "list" ? "enumeration" : step.queryType,
      topics: [...step.topics],
      subTasks: [step.label],
      executor,
      enumerationControl:
        step.kind === "list" ? (step.enumerationControl ?? null) : null,
      identityField: step.identityField ?? null,
      enumerationPage: step.enumerationPage,
      enumerationPageSize: step.enumerationPageSize,
      toolId: step.toolId ?? null,
      dataSource: step.dataSource ?? null,
      targetLang: step.targetLang ?? null,
      sourceLang: step.sourceLang ?? null,
      userFactKey: step.userFactKey ?? null,
      userFactLabel: step.userFactLabel ?? null,
      params: step.params ?? null,
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
