import { dedupeCitations } from "@/agentflow/agents/online/content-organizer";
import { composeEnumerationAnswer } from "@/agentflow/agents/online/information-analyst/compose";
import type { SubQuestionAnalyzeInput } from "@/agentflow/agents/online/information-analyst/analyze";
import { resolveAnalystQueryProfile } from "@/agentflow/agents/online/information-analyst/limits";
import type { InformationAnalystResult } from "@/agentflow/agents/online/information-analyst/interface";
import {
    buildAgeAnswer,
    buildIdentityFieldAnswer,
    buildTenureAnswer,
    extractBirthOrAgeFromHits,
    extractIdentityFieldFromHits,
    extractTenureFromHits,
    isAgeSubQuestion,
} from "../identity";
import {
    buildExternalLinksAnswer,
    extractExternalLinksFromHits,
    resolveExternalLinkScope,
} from "../links";
import { resolveIdentityFieldFromPlan } from "@/agentflow/agents/online/tool-orchestrator/catalog";
import type { OrchestratedToolId } from "./interface";

const ageContext = (input: SubQuestionAnalyzeInput): string =>
    [input.userQuestion, ...(input.topics ?? [])].join(" ");

/** 命中则跳过 Analyst LLM，改走确定性编排工具 */
export const resolveOrchestratedTool = (
    input: SubQuestionAnalyzeInput
): OrchestratedToolId | null => {
    if (input.hits.length === 0 || input.coverage === "none") return null;

    const profile =
        input.queryType ??
        resolveAnalystQueryProfile({
            userQuestion: input.userQuestion,
            subTasks: [input.userQuestion],
        });

    if (profile === "enumeration") return "compose_enumeration";

    if (profile === "external_link") return "extract_external_links_from_hits";

    if (profile === "identity") {
        const fieldSpec = resolveIdentityFieldFromPlan({
            identityField: input.identityField ?? null,
        });
        if (fieldSpec?.toolId === "compute_tenure_from_hits") {
            return "compute_tenure_from_hits";
        }
        if (fieldSpec?.toolId === "compute_age_from_hits") {
            return "compute_age_from_hits";
        }
        if (fieldSpec?.toolId === "extract_identity_from_hits") {
            return "extract_identity_from_hits";
        }
        if (isAgeSubQuestion(ageContext(input))) {
            return "compute_age_from_hits";
        }
    }

    return null;
};

const computeAgeFromHits = (
    input: SubQuestionAnalyzeInput
): InformationAnalystResult => {
    const extraction = extractBirthOrAgeFromHits(input.hits);
    const { answer, insufficientEvidence } = buildAgeAnswer({
        extraction,
        language: input.language,
        asOfDate: input.asOfDate,
    });
    const citations =
        insufficientEvidence || !extraction.sourceHit
            ? []
            : dedupeCitations([
                  {
                      path: extraction.sourceHit.path,
                      excerpt: extraction.sourceHit.excerpt,
                  },
              ]);
    return {
        answer,
        citations,
        confidence: insufficientEvidence ? 0.85 : 0.9,
        insufficientEvidence,
    };
};

const computeTenureFromHits = (
    input: SubQuestionAnalyzeInput
): InformationAnalystResult => {
    const extraction = extractTenureFromHits(input.hits);
    const { answer, insufficientEvidence } = buildTenureAnswer({
        extraction,
        language: input.language,
        asOfDate: input.asOfDate,
        searchQuery: input.searchQuery,
    });
    const citations =
        extraction?.sourceHit && !insufficientEvidence
            ? dedupeCitations([
                  {
                      path: extraction.sourceHit.path,
                      excerpt: extraction.sourceHit.excerpt,
                  },
              ])
            : [];
    return {
        answer,
        citations,
        confidence: insufficientEvidence ? 0.85 : 0.9,
        insufficientEvidence,
    };
};

const extractIdentityFromHits = (
    input: SubQuestionAnalyzeInput
): InformationAnalystResult => {
    const field =
        input.identityField ??
        resolveIdentityFieldFromPlan({ identityField: null })?.id ??
        "name";
    const resolvedField =
        field === "name" ||
        field === "age" ||
        field === "birthYear" ||
        field === "email" ||
        field === "phone" ||
        field === "education" ||
        field === "career"
            ? field
            : "name";
    const extraction = extractIdentityFieldFromHits(input.hits, resolvedField);
    const { answer, insufficientEvidence } = buildIdentityFieldAnswer({
        field: resolvedField,
        extraction,
        language: input.language,
    });
    const citations =
        extraction?.sourceHit && !insufficientEvidence
            ? dedupeCitations([
                  {
                      path: extraction.sourceHit.path,
                      excerpt: extraction.sourceHit.excerpt,
                  },
              ])
            : [];
    return {
        answer,
        citations,
        confidence: insufficientEvidence ? 0.85 : 0.92,
        insufficientEvidence,
    };
};

const extractExternalLinksFromHitsResult = (
    input: SubQuestionAnalyzeInput
): InformationAnalystResult => {
    const scope = resolveExternalLinkScope(
        input.userQuestion,
        input.parentUserQuestion
    );
    const links = extractExternalLinksFromHits(input.hits, scope);
    const { answer, insufficientEvidence } = buildExternalLinksAnswer({
        links,
        language: input.language,
        scope,
    });
    const citations = dedupeCitations(
        links.slice(0, 6).map((l) => ({ path: l.path, excerpt: l.url }))
    );
    return {
        answer,
        citations,
        confidence: insufficientEvidence ? 0.85 : 0.9,
        insufficientEvidence,
    };
};

/** 运行编排工具；无匹配返回 null */
export const runOrchestratedSubQuestion = (
    input: SubQuestionAnalyzeInput
): InformationAnalystResult | null => {
    const toolId = resolveOrchestratedTool(input);
    if (!toolId) return null;

    switch (toolId) {
        case "compose_enumeration":
            return composeEnumerationAnswer({
                hits: input.hits,
                language: input.language,
                topics: input.topics ?? [],
                label: input.userQuestion,
                enumerationMeta: input.enumerationMeta,
                notes: input.notes,
                listIntent: input.listIntent,
            });
        case "compute_age_from_hits":
            return computeAgeFromHits(input);
        case "compute_tenure_from_hits":
            return computeTenureFromHits(input);
        case "extract_identity_from_hits":
            return extractIdentityFromHits(input);
        case "extract_external_links_from_hits":
            return extractExternalLinksFromHitsResult(input);
        case "search_web":
        case "translate_text":
            return null;
        default:
            return null;
    }
};
