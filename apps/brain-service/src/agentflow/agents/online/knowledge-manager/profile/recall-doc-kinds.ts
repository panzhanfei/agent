import type { CorpusDocKind } from "@fambrain/corpus";
import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import type { QueryProfile } from "./interface";

export type RecallListKind = "project" | "experience";

const IDENTITY_PLUS_EXPERIENCE = new Set<IntakeIdentityField>([
    "tenure",
    "career",
]);

/**
 * schema → executor：按 Intake queryType / identityField / listKind 收窄 Qdrant docKind。
 * 不进 prompt；default / 未识别类型 → 不过滤（全库）；relations → 仅亲友名册。
 * 过滤命中为空时不得回退无过滤。
 */
export const recallDocKindsForQuery = (
    queryType: QueryProfile | null | undefined,
    identityField?: IntakeIdentityField | null,
    listKind?: RecallListKind | null
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
            return null;
    }
};
