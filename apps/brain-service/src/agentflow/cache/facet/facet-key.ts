/**
 * facetKey：会话内「同一语义槽」的稳定键。
 *
 * 键按 queryType 分桶：enum:* / id:* / tech:* / link:* / default:*
 * 槽位模板来自 Intake；本文件只负责算 key。
 */
import { normalizeSearchQuery } from "@fambrain/infra";
import type { CachedFacetAnswer } from "@fambrain/infra";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import type { EnumerationControlAction } from "@/agentflow/agents/online/corpus-lister/enumeration";
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

const labelNorm = (label: string): string =>
    normalizeSearchQuery(label).replace(/\s+/g, " ");

const isPaginatedListCorpusAction = (
    action: EnumerationControlAction | undefined
): action is "continue" | "exhaustive" =>
    action === "continue" || action === "exhaustive";

/** list_corpus + exhaustive/continue → facet 缓存按页分桶 */
export const isPaginatedListCorpusSlot = (
    slot: Pick<CompositeRetrievalSlot, "executor" | "enumerationControl">
): boolean =>
    slot.executor === "list_corpus" &&
    isPaginatedListCorpusAction(slot.enumerationControl?.action);

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

const IDENTITY_FACET_KEY: Record<IntakeIdentityField, string> = {
    name: "id:name",
    age: "id:age",
    email: "id:email",
    phone: "id:phone",
    education: "id:education",
    career: "id:career",
    tenure: "id:tenure",
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
    const ln = labelNorm(item.label);

    if (canonical.queryType === "enumeration") {
        const target = resolveEnumerationTarget({
            label: item.label,
            searchQuery: canonical.searchQuery,
            topics: canonical.topics,
            listKind: item.enumerationControl?.listKind ?? null,
        });
        const base = target === "project" ? "enum:projects" : "enum:employers";
        const executor =
            "executor" in source ? source.executor : undefined;
        const action = item.enumerationControl?.action;
        if (
            executor === "list_corpus" &&
            isPaginatedListCorpusAction(action)
        ) {
            const page =
                "enumerationPage" in source &&
                typeof source.enumerationPage === "number"
                    ? Math.max(1, source.enumerationPage)
                    : 1;
            return `${base}:p${page}`;
        }
        return base;
    }

    if (canonical.queryType === "identity") {
        const field = canonical.identityField ?? item.identityField ?? null;
        if (field && IDENTITY_FACET_KEY[field]) {
            return IDENTITY_FACET_KEY[field];
        }
        return `id:profile:${ln.slice(0, 24) || "general"}`;
    }

    if (canonical.queryType === "external_link") {
        return `link:${ln.slice(0, 32) || "external"}`;
    }

    if (canonical.queryType === "tech") {
        return `tech:${ln.slice(0, 32) || "general"}`;
    }

    return `default:${ln.slice(0, 32) || canonical.queryType}`;
};

export const attachFacetKey = (
    slot: CompositeRetrievalSlot
): CompositeRetrievalSlot & { facetKey: string } => ({
    ...slot,
    facetKey: buildFacetKey(slot),
});
