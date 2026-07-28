import type { EnumerationListIntent } from "@/agentflow/agents/online/intake-coordinator";
import type {
    EnumerationMeta,
    KnowledgeHit,
} from "@/agentflow/agents/online/knowledge-manager/contract/types";
import {
    getProfileRecallParams,
    PROFILE_MAX_HITS,
} from "@/agentflow/agents/online/knowledge-manager/profile/km-config";
import {
    resolveQueryProfile,
    type QueryProfile,
} from "@/agentflow/agents/online/knowledge-manager/profile/query-profile";

/** Analyst 子问 / 单问可见 hits 上限（与 KM profile 对齐，非固定 4）。 */
export const maxAnalystHitsForProfile = (profile: QueryProfile): number =>
    getProfileRecallParams(profile).maxHits;

/** 流式 / compose 前列举 hits：分页列举信 enumerationMeta.pageSize，勿用 profile maxHits=8 截断。 */
export const sliceHitsForAnalystStream = (
    profile: QueryProfile,
    hits: KnowledgeHit[],
    opts?: {
        enumerationMeta?: EnumerationMeta | null;
        listIntent?: EnumerationListIntent | null;
    }
): KnowledgeHit[] => {
    if (profile === "enumeration") {
        const pageSize = opts?.enumerationMeta?.pageSize;
        if (pageSize && pageSize > 0) {
            return hits.slice(0, pageSize);
        }
    }
    return hits.slice(0, maxAnalystHitsForProfile(profile));
};

export const resolveAnalystQueryProfile = (input: {
    userQuestion: string;
    subTasks?: string[];
    queryType?: QueryProfile | null;
    searchQuery?: string;
}): QueryProfile =>
    resolveQueryProfile(
        input.searchQuery?.trim() || input.userQuestion,
        input.subTasks ?? [],
        input.queryType ?? undefined
    );

/** 单问非 tech 走纯文本流式，避免 JSON + think 解析失败退回 excerpt 体。 */
export const prefersPlainTextAnalystStream = (profile: QueryProfile): boolean =>
    profile === "enumeration" ||
    profile === "identity" ||
    profile === "external_link" ||
    profile === "default";

/** @deprecated 测试兼容；新代码用 maxAnalystHitsForProfile */
export const MAX_SUB_QUESTION_HITS = PROFILE_MAX_HITS.default;
