/**
 * facetKey：会话内成稿缓存键。
 *
 * `{queryType桶}:{字段或列举类}:{归一化 searchQuery}[:p{页码}]`
 * 只信 Intake 结构化字段；searchQuery 进键，避免同字段不同问法互相覆盖。
 * 换口命中靠 Intake 写出同一 searchQuery，不靠收成 `id:age` 单坑。
 */
import { normalizeSearchQuery } from "@fambrain/infra";
import type { CachedFacetAnswer } from "@fambrain/infra";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import {
    canonicalizePlanItem,
    resolveEnumerationTarget,
} from "@/agentflow/agents/online/intake-coordinator";
import type {
    IntakeIdentityField,
    IntakeRetrievalPlanItem,
} from "@/agentflow/agents/online/intake-coordinator/contract";

type FacetSource =
    | Pick<
          IntakeRetrievalPlanItem,
          | "label"
          | "searchQuery"
          | "queryType"
          | "topics"
          | "enumerationControl"
          | "identityField"
      >
    | CompositeRetrievalSlot;

const IDENTITY_FIELDS = new Set<string>([
    "name",
    "age",
    "birthYear",
    "email",
    "phone",
    "education",
    "career",
    "tenure",
]);

const isListCorpusEnumerationSlot = (
    slot: Pick<CompositeRetrievalSlot, "executor" | "enumerationControl">
): boolean =>
    slot.executor === "list_corpus" && Boolean(slot.enumerationControl);

/** list_corpus 列举槽 → facet 缓存按页分桶（preview = p1） */
export const isPaginatedListCorpusSlot = isListCorpusEnumerationSlot;

/** 槽答案缓存命中时校验列举页码（防 continue 复用上一页终稿） */
export const facetAnswerMatchesSlot = (
    cached: CachedFacetAnswer,
    slot: CompositeRetrievalSlot
): boolean => {
    if (!isPaginatedListCorpusSlot(slot)) return true;
    const wantPage = slot.enumerationPage ?? 1;
    if (cached.enumerationPage == null) return wantPage === 1;
    return cached.enumerationPage === wantPage;
};

/**
 * @deprecated 禁止问句口语词表清 cache。
 * 槽答案失效靠 facetKey 变化 / 会话自然过期。
 */
export const detectCompositeRefreshIntent = (_userQuestion: string): boolean =>
    false;

const querySeg = (searchQuery: string): string => {
    const q = normalizeSearchQuery(searchQuery).slice(0, 40);
    return q || "general";
};

const topicClass = (
    topics: readonly string[] | undefined,
    fallback: string
): string => {
    const raw = topics?.[0]?.trim().toLowerCase() ?? "";
    const cleaned = raw.replace(/[:\s]+/g, "-").slice(0, 24);
    return cleaned || fallback;
};

const withPage = (base: string, source: FacetSource, item: FacetSource): string => {
    const executor = "executor" in source ? source.executor : undefined;
    if (executor !== "list_corpus" || !("enumerationControl" in item) || !item.enumerationControl) {
        return base;
    }
    const page =
        "enumerationPage" in source && typeof source.enumerationPage === "number"
            ? Math.max(1, source.enumerationPage)
            : 1;
    return `${base}:p${page}`;
};

/**
 * 兼容旧键 `id:age` 与新键 `id:age:{query}`。
 * 业务分型优先信 identityField；此函数只作 facetKey 兜底。
 */
export const facetKeyMatchesIdentity = (
    facetKey: string | undefined,
    field: IntakeIdentityField
): boolean => {
    if (!facetKey) return false;
    const prefix = `id:${field}`;
    return facetKey === prefix || facetKey.startsWith(`${prefix}:`);
};

export const buildFacetKey = (source: FacetSource): string => {
    const item =
        "searchQuery" in source && "queryType" in source
            ? {
                  label: source.label,
                  searchQuery: source.searchQuery,
                  queryType: source.queryType,
                  topics: source.topics,
                  enumerationControl:
                      "enumerationControl" in source
                          ? source.enumerationControl
                          : null,
                  identityField:
                      "identityField" in source
                          ? source.identityField
                          : null,
              }
            : source;

    const canonical = canonicalizePlanItem({
        label: item.label,
        searchQuery: item.searchQuery,
        queryType: item.queryType,
        topics: item.topics,
        enumerationControl: item.enumerationControl ?? null,
        identityField: item.identityField ?? null,
    });
    const q = querySeg(item.searchQuery);

    if (canonical.queryType === "enumeration") {
        const target = resolveEnumerationTarget({
            label: item.label,
            searchQuery: canonical.searchQuery,
            topics: canonical.topics,
            listKind: item.enumerationControl?.listKind ?? null,
        });
        const cls = target === "project" ? "projects" : "employers";
        return withPage(`enum:${cls}:${q}`, source, item);
    }

    if (canonical.queryType === "identity") {
        const field = canonical.identityField ?? item.identityField ?? null;
        const cls =
            field && IDENTITY_FIELDS.has(field) ? field : "profile";
        return `id:${cls}:${q}`;
    }

    if (canonical.queryType === "external_link") {
        return `link:${topicClass(item.topics, "external")}:${q}`;
    }

    if (canonical.queryType === "tech") {
        return `tech:${topicClass(item.topics, "general")}:${q}`;
    }

    if (canonical.queryType === "relations") {
        return `rel:${topicClass(item.topics, "family")}:${q}`;
    }

    return `default:${topicClass(item.topics, canonical.queryType)}:${q}`;
};

export const attachFacetKey = (
    slot: CompositeRetrievalSlot
): CompositeRetrievalSlot & { facetKey: string } => ({
    ...slot,
    facetKey: buildFacetKey(slot),
});
