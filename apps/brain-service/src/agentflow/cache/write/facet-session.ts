import {
    upsertFacetAnswers,
    type CachedFacetAnswer,
    type CompositeSessionKey,
} from "@fambrain/infra";

export type WriteFacetSessionInput = {
    facets: CachedFacetAnswer[];
    userQuestion: string;
    fullAnswer: string;
    facetKeys: string[];
};

/** 写入 composite 会话 facet 答案缓存（Analyst 出稿后） */
export const writeFacetSession = async (
    parts: CompositeSessionKey,
    input: WriteFacetSessionInput
): Promise<void> => {
    await upsertFacetAnswers(parts, input);
};
