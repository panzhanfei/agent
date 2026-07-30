import type { CachedFacetAnswer } from "@fambrain/infra";
import type { InformationAnalystResult } from "@/agentflow/agents/online/information-analyst/prompt";

/** 缓存终稿 → Analyst 结果形状（供增量跳过 Analyst 时复用） */
export const cachedFacetToAnalystResult = (
    cached: CachedFacetAnswer
): InformationAnalystResult => ({
    answer: cached.answer,
    citations: cached.citations,
    confidence: cached.confidence,
    insufficientEvidence: cached.insufficientEvidence,
    blocks: cached.blocks,
});

const enumBlockFromResult = (
    result: InformationAnalystResult
): { page?: number; total?: number; listKind?: "project" | "experience" } => {
    const block = result.blocks?.find((b) => b.type === "enumeration");
    if (!block || block.type !== "enumeration") return {};
    return {
        page: block.page,
        total: block.total,
        listKind: block.listKind === "employer" ? "experience" : "project",
    };
};

/** Analyst 结果 → 可写入会话的 CachedFacetAnswer */
export const analystResultToCachedFacet = (
    facetKey: string,
    label: string,
    result: InformationAnalystResult,
    coverage: CachedFacetAnswer["coverage"]
): CachedFacetAnswer => {
    const meta = enumBlockFromResult(result);
    return {
        facetKey,
        label,
        answer: result.answer,
        citations: result.citations,
        coverage,
        insufficientEvidence: result.insufficientEvidence,
        confidence: result.confidence,
        cachedAt: Date.now(),
        blocks: result.blocks,
        enumerationPage: meta.page,
        enumerationTotal: meta.total,
        listKind: meta.listKind,
    };
};
