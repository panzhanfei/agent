import { z } from "zod";
import {
  nonEmptyStringArray,
  nullableTrimmedString,
  unitInterval,
} from "@/agentflow/utils";
import type { IntakeRoutingDecision } from "./interface";
import type { PathPlan } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
const INTAKE_QUERY_TYPES = [
  "identity",
  "enumeration",
  "tech",
  "external_link",
  "relations",
  "default",
] as const;

/** 非法 LLM 自造类型 → 合法枚举或 default（避免整份 retrievalPlan 被 .catch([]) 丢光） */
export const intakeQueryTypeSchema = z.preprocess((v) => {
  if (typeof v !== "string") return "default";
  if ((INTAKE_QUERY_TYPES as readonly string[]).includes(v)) return v;
  const lower = v.trim().toLowerCase();
  if (
    lower === "role" ||
    lower === "employment" ||
    lower === "employer" ||
    lower === "company"
  ) {
    return "enumeration";
  }
  if (
    lower === "links" ||
    lower === "link" ||
    lower === "url" ||
    lower === "github"
  ) {
    return "external_link";
  }
  if (lower === "tech_stack" || lower === "stack") return "tech";
  if (lower === "family" || lower === "relation" || lower === "kin") {
    return "relations";
  }
  if (
    lower === "timeline" ||
    lower === "history" ||
    lower === "time_duration"
  ) {
    return "identity";
  }
  return "default";
}, z.enum(INTAKE_QUERY_TYPES));
/** LLM 偶发短别名 → 合法 intent（schema 合法化，非用户口语词表） */
const normalizeIntakeIntent = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  const t = v.trim().toLowerCase();
  if (
    t === "remember" ||
    t === "remember_fact" ||
    t === "remember_user" ||
    t === "save_user_fact"
  ) {
    return "remember_user_fact";
  }
  if (
    t === "recall" ||
    t === "recall_fact" ||
    t === "recall_user" ||
    t === "load_user_fact"
  ) {
    return "recall_user_fact";
  }
  return v;
};

export const intakeIntentSchema = z.preprocess(
  normalizeIntakeIntent,
  z.enum([
    "retrieve_and_answer",
    "summarize_content",
    "direct_answer",
    "clarify",
    "chitchat",
    "out_of_scope",
    "remember_user_fact",
    "recall_user_fact",
  ])
);
export const intakeLanguageSchema = z
  .enum(["zh", "en", "mixed"])
  .catch("zh" as const);
/** LLM 偶发别名 → 合法 listKind（schema 合法化，非用户口语词表） */
const normalizeListKind = (v: unknown): "project" | "experience" | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  if (t === "project" || t === "projects") return "project";
  if (
    t === "experience" ||
    t === "employer" ||
    t === "employers" ||
    t === "company" ||
    t === "companies"
  ) {
    return "experience";
  }
  return null;
};

export const enumerationControlSchema = z
  .object({
    action: z.enum(["preview", "continue", "exhaustive"]),
    listKind: z.preprocess(
      normalizeListKind,
      z.enum(["project", "experience"])
    ),
    excludeHint: z
      .union([z.string(), z.null()])
      .optional()
      .transform((v) => (typeof v === "string" ? v.trim() || null : null)),
    timeWindowYears: z
      .union([z.number(), z.null()])
      .optional()
      .transform((v) => {
        if (v == null || typeof v !== "number" || !Number.isFinite(v)) {
          return null;
        }
        const n = Math.floor(v);
        return n > 0 && n <= 50 ? n : null;
      }),
  })
  .nullable()
  .optional()
  .catch(null);

/** LLM 偶发字段名 → 合法 identityField */
const normalizeIdentityField = (
  v: unknown
):
  | "name"
  | "age"
  | "birthYear"
  | "email"
  | "phone"
  | "education"
  | "career"
  | "tenure"
  | null => {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  const allowed = [
    "name",
    "age",
    "birthYear",
    "email",
    "phone",
    "education",
    "career",
    "tenure",
  ] as const;
  if ((allowed as readonly string[]).includes(t)) {
    return t as (typeof allowed)[number];
  }
  const lower = t.toLowerCase();
  if (
    lower === "birth_year" ||
    lower === "birthyear" ||
    lower === "year_of_birth" ||
    lower === "yearofbirth"
  ) {
    return "birthYear";
  }
  if (
    lower === "careerduration" ||
    lower === "tenure_years" ||
    lower === "yearsofexperience" ||
    lower === "years_of_experience" ||
    lower === "workyears"
  ) {
    return "tenure";
  }
  return null;
};

export const intakeIdentityFieldSchema = z
  .preprocess(
    normalizeIdentityField,
    z
      .enum([
        "name",
        "age",
        "birthYear",
        "email",
        "phone",
        "education",
        "career",
        "tenure",
      ])
      .nullable()
  )
  .optional()
  .catch(null);

export const intakeRetrievalPlanItemSchema = z.object({
  label: z.coerce.string().transform((s) => String(s).trim()),
  searchQuery: z.coerce.string().transform((s) => String(s).trim()),
  queryType: intakeQueryTypeSchema,
  topics: nonEmptyStringArray.catch([]),
  enumerationControl: enumerationControlSchema,
  identityField: intakeIdentityFieldSchema,
});
/** pathPlan 由 pipeline legalizePathPlan 深合法化；此处仅透传对象 */
export const intakePathPlanPassthroughSchema = z
  .unknown()
  .optional()
  .nullable()
  .catch(null);

export const intakeComposeModeSchema = z
  .enum(["qa", "composite", "summarize"])
  .optional()
  .nullable()
  .catch(null);

export const intakeAnswerOrderSchema = z
  .array(z.coerce.string().transform((s) => String(s).trim()).pipe(z.string().min(1)))
  .optional()
  .nullable()
  .catch([]);

export const intakeRoutingDecisionSchema = z.object({
  intent: intakeIntentSchema,
  searchQuery: z.coerce.string().transform((s) => String(s).trim()),
  subTasks: nonEmptyStringArray.catch([]),
  topics: nonEmptyStringArray.catch([]),
  language: intakeLanguageSchema,
  confidence: unitInterval,
  queryType: z
    .preprocess((v) => {
      if (v === null || v === undefined) return null;
      if (typeof v !== "string") return null;
      if ((INTAKE_QUERY_TYPES as readonly string[]).includes(v)) return v;
      const lower = v.trim().toLowerCase();
      if (lower === "family" || lower === "relation" || lower === "kin") {
        return "relations";
      }
      return null;
    }, z.enum(INTAKE_QUERY_TYPES).nullable())
    .catch(null),
  clarifyingQuestion: nullableTrimmedString,
  briefReply: nullableTrimmedString,
  /** 兼容/派生；LLM 可不填，pipeline 从 pathPlan 生成 */
  retrievalPlan: z.array(intakeRetrievalPlanItemSchema).catch([]),
  pathPlan: intakePathPlanPassthroughSchema,
  answerOrder: intakeAnswerOrderSchema,
  composeMode: intakeComposeModeSchema,
  userFactKey: z.preprocess(
    (v) => (v === undefined ? null : v),
    nullableTrimmedString
  ),
  userFactLabel: z.preprocess(
    (v) => (v === undefined ? null : v),
    nullableTrimmedString
  ),
  userFactValue: z.preprocess(
    (v) => (v === undefined ? null : v),
    nullableTrimmedString
  ),
  attachmentAction: z
    .preprocess((v) => {
      if (v === null || v === undefined || v === "") return null;
      if (typeof v !== "string") return null;
      const s = v.trim().toLowerCase();
      if (s === "ingest") return "summarize";
      if (s === "extract" || s === "summarize" || s === "translate") {
        return s;
      }
      return null;
    }, z.enum(["extract", "summarize", "translate"]).nullable())
    .catch(null),
  coreference: z
    .enum(["none", "resolved", "unresolved"])
    .catch("none" as const)
    .default("none"),
});
const pickIntakeField = (
  raw: Record<string, unknown>,
  camel: string,
  snake: string
): unknown => (camel in raw ? raw[camel] : raw[snake]);

const normalizePlanItem = (
  item: Record<string, unknown>
): Record<string, unknown> => {
  const control = pickIntakeField(
    item,
    "enumerationControl",
    "enumeration_control"
  );
  return {
    ...item,
    searchQuery: pickIntakeField(item, "searchQuery", "search_query"),
    queryType: pickIntakeField(item, "queryType", "query_type"),
    enumerationControl: control,
    identityField: pickIntakeField(item, "identityField", "identity_field"),
  };
};

const normalizePathPlanStep = (
  item: Record<string, unknown>
): Record<string, unknown> => {
  const kind =
    pickIntakeField(item, "kind", "kind") ??
    pickIntakeField(item, "pathKind", "path_kind");
  return {
    ...item,
    kind,
    pathKind: kind,
    searchQuery: pickIntakeField(item, "searchQuery", "search_query"),
    queryType: pickIntakeField(item, "queryType", "query_type"),
    identityField: pickIntakeField(item, "identityField", "identity_field"),
    toolId: pickIntakeField(item, "toolId", "tool_id"),
    dataSource: pickIntakeField(item, "dataSource", "data_source"),
    enumerationControl: pickIntakeField(
      item,
      "enumerationControl",
      "enumeration_control"
    ),
    enumerationPage: pickIntakeField(item, "enumerationPage", "enumeration_page"),
    enumerationPageSize: pickIntakeField(
      item,
      "enumerationPageSize",
      "enumeration_page_size"
    ),
  };
};

const normalizePathPlanBucket = (raw: unknown): unknown => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? normalizePathPlanStep(item as Record<string, unknown>)
      : item
  );
};

/**
 * 从 pathPlan 步抬升顶层 userFact*（LLM 偶发只写在 mem 步 / params）。
 * 只信结构化字段与 step.id slug，不从用户口语发明 key。
 */
const liftUserFactFieldsFromPathPlan = (
  raw: Record<string, unknown>,
  pathPlan: unknown
): {
  userFactKey: unknown;
  userFactLabel: unknown;
  userFactValue: unknown;
} => {
  let userFactKey = pickIntakeField(raw, "userFactKey", "user_fact_key");
  let userFactLabel = pickIntakeField(raw, "userFactLabel", "user_fact_label");
  let userFactValue = pickIntakeField(raw, "userFactValue", "user_fact_value");
  const hasKey = typeof userFactKey === "string" && userFactKey.trim();
  const hasValue = typeof userFactValue === "string" && userFactValue.trim();
  if (hasKey && hasValue) {
    return { userFactKey, userFactLabel, userFactValue };
  }

  const collectSteps = (): Record<string, unknown>[] => {
    if (Array.isArray(pathPlan)) {
      return pathPlan.filter(
        (s): s is Record<string, unknown> =>
          Boolean(s) && typeof s === "object" && !Array.isArray(s)
      );
    }
    if (pathPlan && typeof pathPlan === "object" && !Array.isArray(pathPlan)) {
      const pp = pathPlan as Record<string, unknown>;
      const out: Record<string, unknown>[] = [];
      if (Array.isArray(pp.steps)) {
        for (const s of pp.steps) {
          if (s && typeof s === "object" && !Array.isArray(s)) {
            out.push(s as Record<string, unknown>);
          }
        }
      }
      for (const bucket of ["km", "list", "tool", "dag", "mem"] as const) {
        const arr = pp[bucket];
        if (!Array.isArray(arr)) continue;
        for (const s of arr) {
          if (s && typeof s === "object" && !Array.isArray(s)) {
            out.push(s as Record<string, unknown>);
          }
        }
      }
      return out;
    }
    return [];
  };

  const slugFromStepId = (id: unknown): string | null => {
    if (typeof id !== "string") return null;
    const m = id.trim().match(/^mem[-_]?([a-z][a-z0-9_+-]{0,63})$/i);
    return m?.[1]?.toLowerCase() ?? null;
  };

  const asciiSlug = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim().toLowerCase();
    if (!t || !/^[a-z][a-z0-9_+-]{0,63}$/.test(t)) return null;
    return t;
  };

  for (const step of collectSteps()) {
    const kind = String(step.kind ?? step.pathKind ?? "").toLowerCase();
    const params =
      step.params && typeof step.params === "object" && !Array.isArray(step.params)
        ? (step.params as Record<string, unknown>)
        : null;
    const op = String(params?.operation ?? "").toLowerCase();
    const keySlugHint =
      asciiSlug(step.userFactKey) ||
      asciiSlug(params?.userFactKey) ||
      asciiSlug(params?.factKey) ||
      asciiSlug(params?.key) ||
      slugFromStepId(step.id);
    const looksMem =
      kind === "mem" ||
      kind.includes("user_fact") ||
      op === "remember_user_fact" ||
      op === "remember" ||
      op === "recall_user_fact" ||
      op === "recall" ||
      Boolean(step.userFactKey) ||
      Boolean(params?.userFactKey) ||
      Boolean(params?.factKey) ||
      Boolean(keySlugHint && (params?.value || step.userFactValue));
    if (!looksMem) continue;

    if (!hasKey) {
      userFactKey =
        asciiSlug(step.userFactKey) ||
        asciiSlug(params?.userFactKey) ||
        asciiSlug(params?.factKey) ||
        asciiSlug(params?.key) ||
        slugFromStepId(step.id) ||
        userFactKey;
    }
    if (!(typeof userFactLabel === "string" && userFactLabel.trim())) {
      const labelCand =
        step.userFactLabel ?? params?.label ?? params?.userFactLabel ?? step.label;
      if (typeof labelCand === "string" && labelCand.trim()) {
        userFactLabel = labelCand.trim();
      }
    }
    if (!hasValue) {
      const valueCand =
        step.userFactValue ?? params?.userFactValue ?? params?.value;
      if (typeof valueCand === "string" && valueCand.trim()) {
        userFactValue = valueCand.trim();
      }
    }
    break;
  }

  return { userFactKey, userFactLabel, userFactValue };
};

const normalizeIntakeRaw = (
  raw: Record<string, unknown>
): Record<string, unknown> => {
  const planRaw = pickIntakeField(raw, "retrievalPlan", "retrieval_plan");
  const retrievalPlan = Array.isArray(planRaw)
    ? planRaw.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? normalizePlanItem(item as Record<string, unknown>)
          : item
      )
    : planRaw;
  const pathPlanRaw = pickIntakeField(raw, "pathPlan", "path_plan");
  let pathPlan: unknown = pathPlanRaw;
  if (pathPlanRaw && typeof pathPlanRaw === "object" && !Array.isArray(pathPlanRaw)) {
    const pp = pathPlanRaw as Record<string, unknown>;
    const stepsRaw = Array.isArray(pp.steps) ? pp.steps : null;
    pathPlan = {
      ...pp,
      steps: stepsRaw
        ? normalizePathPlanBucket(stepsRaw)
        : undefined,
      // 保留旧四桶供 legalize 兼容转换
      km: normalizePathPlanBucket(pp.km),
      list: normalizePathPlanBucket(pp.list),
      tool: normalizePathPlanBucket(pp.tool),
      dag: normalizePathPlanBucket(pp.dag),
      answerOrder: pickIntakeField(pp, "answerOrder", "answer_order"),
    };
  }
  const lifted = liftUserFactFieldsFromPathPlan(raw, pathPlanRaw ?? pathPlan);
  return {
    ...raw,
    intent: normalizeIntakeIntent(pickIntakeField(raw, "intent", "intent")),
    searchQuery: pickIntakeField(raw, "searchQuery", "search_query"),
    subTasks: pickIntakeField(raw, "subTasks", "sub_tasks"),
    queryType: pickIntakeField(raw, "queryType", "query_type"),
    clarifyingQuestion: pickIntakeField(
      raw,
      "clarifyingQuestion",
      "clarifying_question"
    ),
    briefReply: pickIntakeField(raw, "briefReply", "brief_reply"),
    retrievalPlan,
    pathPlan,
    answerOrder: pickIntakeField(raw, "answerOrder", "answer_order"),
    composeMode: pickIntakeField(raw, "composeMode", "compose_mode"),
    userFactKey: lifted.userFactKey,
    userFactLabel: lifted.userFactLabel,
    userFactValue: lifted.userFactValue,
    attachmentAction: pickIntakeField(
      raw,
      "attachmentAction",
      "attachment_action"
    ),
  };
};

export const parseIntakeRoutingDecision = (
  raw: unknown
): IntakeRoutingDecision | null => {
  const normalized =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? normalizeIntakeRaw(raw as Record<string, unknown>)
      : raw;
  const parsed = intakeRoutingDecisionSchema.safeParse(normalized);
  if (!parsed.success) return null;
  const data = parsed.data;
  /** 深合法化在 pipeline.legalizePathPlan；此处仅收窄类型 */
  const pathPlan =
    data.pathPlan == null
      ? data.pathPlan
      : (data.pathPlan as PathPlan);
  return {
    ...data,
    pathPlan,
    answerOrder: data.answerOrder ?? [],
    composeMode: data.composeMode ?? null,
  };
};
