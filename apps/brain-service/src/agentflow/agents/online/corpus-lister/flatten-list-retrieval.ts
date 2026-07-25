import type { FlattenedListRetrieval, ListSlotRetrieval } from "./interface";

/**
 * 纯 list 线路：将 fetchListSlot 结果摊平为 PipelineGraphState 检索字段。
 * 不调用 KM mergeCompositeRetrieval（多槽合并留在 planExecutor / retrieval-node）。
 */
export const flattenListRetrieval = (
    subResults: ListSlotRetrieval[]
): FlattenedListRetrieval => {
    if (subResults.length === 0) {
        return {
            hits: [],
            coverage: "none",
            notes: null,
            confidenceTier: null,
            enumerationMeta: null,
        };
    }
    if (subResults.length === 1) {
        const sub = subResults[0]!;
        return {
            hits: sub.hits,
            coverage: sub.coverage,
            notes: sub.notes,
            confidenceTier: sub.confidenceTier ?? null,
            enumerationMeta: sub.enumerationMeta ?? null,
        };
    }
    const byPath = new Map<string, ListSlotRetrieval["hits"][number]>();
    for (const sub of subResults) {
        for (const hit of sub.hits) {
            const prev = byPath.get(hit.path);
            if (!prev || hit.relevance > prev.relevance) {
                byPath.set(hit.path, hit);
            }
        }
    }
    const hits = [...byPath.values()].sort((a, b) => b.relevance - a.relevance);
    const coverages = subResults.map((s) => s.coverage);
    const coverage =
        coverages.every((c) => c === "none")
            ? "none"
            : coverages.every((c) => c === "sufficient")
              ? "sufficient"
              : "partial";
    const notesParts = subResults
        .map((s) => s.notes?.trim())
        .filter((n): n is string => Boolean(n));
    const enumerationMeta =
        subResults.find((s) => s.enumerationMeta)?.enumerationMeta ?? null;
    return {
        hits,
        coverage: hits.length === 0 ? "none" : coverage,
        notes: notesParts.length > 0 ? notesParts.join(" ") : null,
        confidenceTier: subResults.find((s) => s.confidenceTier)?.confidenceTier ?? null,
        enumerationMeta,
    };
};
