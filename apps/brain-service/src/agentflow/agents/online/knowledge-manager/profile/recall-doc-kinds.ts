import type { CorpusDocKind } from "@fambrain/corpus";
import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import type { QueryProfile } from "./interface";

export type RecallListKind = "project" | "experience";

const IDENTITY_PLUS_EXPERIENCE = new Set<IntakeIdentityField>([
    "tenure",
    "career",
]);

const topicSet = (topics?: readonly string[] | null): Set<string> =>
    new Set(
        (topics ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean)
    );

/**
 * default 槽：只信 topics 柜标签（与 family→relations 同类），不扫问句。
 * aky / urban-governance 等提示 tag 不是 docKind，忽略。
 */
const docKindsFromDefaultTopics = (
    topics?: readonly string[] | null
): CorpusDocKind[] | null => {
    const set = topicSet(topics);
    if (set.has("family")) return ["relations"];
    const experience = set.has("experience") || set.has("career");
    const project = set.has("project");
    if (experience && project) return ["experience", "project"];
    if (experience) return ["experience"];
    if (project) return ["project"];
    return null;
};

/**
 * schema → executor：按 Intake queryType / identityField / listKind / 槽 topics 收窄 Qdrant docKind。
 * 不进 prompt。已有 queryType 柜（identity / list / tech…）优先，topics 不覆盖。
 * default 无柜 topics → 不过滤（全库）；有 experience/project/family → 滤对应 payload。
 * 过滤命中为空时不得回退无过滤。
 */
export const recallDocKindsForQuery = (
    queryType: QueryProfile | null | undefined,
    identityField?: IntakeIdentityField | null,
    listKind?: RecallListKind | null,
    topics?: readonly string[] | null
): CorpusDocKind[] | null => {
    switch (queryType) {
        case "identity":
            if (
                identityField &&
                IDENTITY_PLUS_EXPERIENCE.has(identityField)
            ) {
                return ["identity_card", "experience"];
            }
            return ["identity_card"];
        case "tech":
            return ["project", "experience"];
        case "enumeration":
            if (listKind === "project") return ["project"];
            if (listKind === "experience") return ["experience"];
            return ["experience", "project"];
        case "external_link":
            return ["project", "experience", "identity_card"];
        case "relations":
            return ["relations"];
        default:
            return docKindsFromDefaultTopics(topics);
    }
};
