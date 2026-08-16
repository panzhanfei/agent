import { dedupeCitations } from "@/agentflow/agents/online/content-organizer";
import { composeEnumerationAnswer } from "@/agentflow/agents/online/information-analyst/compose-message";
import type { InformationAnalystResult } from "@/agentflow/agents/online/information-analyst/prompt";
import { retrieveKnowledge } from "@/agentflow/agents/online/knowledge-manager";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";
import {
    computeAgeFromHitsTool,
    runWithToolContext,
    searchWebTool,
    translateTextTool,
} from "@/agentflow/tools";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator";
import { resolveIdentityField, resolveIdentityFieldFromPlan } from "../catalog";
import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import {
    buildIdentityFieldAnswer,
    buildTenureAnswer,
    extractIdentityFieldFromHits,
    extractTenureFromHits,
} from "@/agentflow/tools/identity";
import {
    buildExternalLinksAnswer,
    extractExternalLinksFromHits,
} from "@/agentflow/tools/links";
import type {
    ExecutionPlanNode,
    PipelineToolResults,
    ToolRunId,
    ToolRunResult,
} from "../interface";
import { isPostRetrievalToolId } from "../interface";

const analystToToolResult = (
    toolId: ToolRunId,
    label: string,
    result: InformationAnalystResult,
    hits: KnowledgeHit[] = []
): ToolRunResult => ({
    toolId,
    label,
    ok: !result.insufficientEvidence,
    answer: result.answer,
    citations: result.citations,
    hits,
    blocks: result.blocks,
    insufficientEvidence: result.insufficientEvidence,
    confidence: result.confidence,
});

export const invokeRetrieveCorpus = async (input: {
    corpusUserId: string;
    actorUserId: string;
    searchQuery: string;
    queryType?: string;
    topics?: string[];
    subTasks?: string[];
}): Promise<{ hits: KnowledgeHit[]; coverage: string; notes: string | null }> => {
    const result = await retrieveKnowledge({
        corpusUserId: input.corpusUserId,
        searchQuery: input.searchQuery,
        topics: input.topics ?? [],
        subTasks: input.subTasks ?? [],
        queryType: (input.queryType as never) ?? null,
        candidates: [],
    });
    return {
        hits: result.hits,
        coverage: result.coverage,
        notes: result.notes,
    };
};

export const invokeSearchWeb = async (input: {
    corpusUserId: string;
    actorUserId: string;
    query: string;
}): Promise<ToolRunResult> => {
    const raw = await runWithToolContext(
        { corpusUserId: input.corpusUserId, actorUserId: input.actorUserId },
        () => searchWebTool.invoke({ query: input.query })
    );
    const parsed = JSON.parse(String(raw)) as {
        status: string;
        query: string;
        results?: Array<{ title: string; url: string; snippet: string }>;
        message?: string;
    };
    const snippets = parsed.results ?? [];
    const ok = parsed.status === "ok" && snippets.length > 0;
    const answer = ok
        ? snippets
              .slice(0, 5)
              .map((s, i) => `${i + 1}. ${s.title}：${s.snippet}`)
              .join("\n")
        : parsed.message ??
          "未配置联网搜索或暂无外部检索结果，请补充语料或配置 TAVILY_API_KEY。";
    return {
        toolId: "search_web",
        label: input.query,
        ok,
        answer,
        citations: snippets.map((s) => ({
            path: s.url,
            excerpt: s.snippet,
        })),
        hits: [],
        insufficientEvidence: !ok,
        confidence: ok ? 0.7 : 0.85,
        webSnippets: snippets,
    };
};

export const invokeTranslateText = async (input: {
    corpusUserId: string;
    actorUserId: string;
    text: string;
    targetLang: string;
    sourceLang?: string | null;
    label: string;
}): Promise<ToolRunResult> => {
    const raw = await runWithToolContext(
        { corpusUserId: input.corpusUserId, actorUserId: input.actorUserId },
        () =>
            translateTextTool.invoke({
                text: input.text,
                targetLang: input.targetLang,
                sourceLang: input.sourceLang ?? undefined,
            })
    );
    const parsed = JSON.parse(String(raw)) as {
        status: string;
        text: string;
        targetLang: string;
        sourceLang: string;
        translation?: string;
        message?: string;
    };
    const ok = parsed.status === "ok" && Boolean(parsed.translation?.trim());
    const answer = ok
        ? parsed.translation!
        : parsed.message ??
          "未配置翻译或翻译失败，请配置 YOUDAO_APP_KEY / YOUDAO_APP_SECRET。";
    return {
        toolId: "translate_text",
        label: input.label || `translate→${input.targetLang}`,
        ok,
        answer,
        citations: [],
        hits: [],
        insufficientEvidence: !ok,
        confidence: ok ? 0.85 : 0.3,
    };
};

export const invokeComputeAge = async (input: {
    corpusUserId: string;
    actorUserId: string;
    hits: KnowledgeHit[];
    asOfDate: string;
    language: "zh" | "en" | "mixed";
    label: string;
}): Promise<ToolRunResult> => {
    const raw = await runWithToolContext(
        { corpusUserId: input.corpusUserId, actorUserId: input.actorUserId },
        () =>
            computeAgeFromHitsTool.invoke({
                hits: input.hits.map((h) => ({
                    path: h.path,
                    excerpt: h.excerpt,
                })),
                asOfDate: input.asOfDate,
                language: input.language,
            })
    );
    const parsed = JSON.parse(String(raw)) as {
        answer: string;
        insufficientEvidence: boolean;
        sourcePath: string | null;
    };
    const citations =
        parsed.sourcePath && input.hits[0]
            ? dedupeCitations([
                  {
                      path: parsed.sourcePath,
                      excerpt: input.hits[0]!.excerpt,
                  },
              ])
            : [];
    return {
        toolId: "compute_age_from_hits",
        label: input.label,
        ok: !parsed.insufficientEvidence,
        answer: parsed.answer,
        citations,
        hits: input.hits,
        insufficientEvidence: parsed.insufficientEvidence,
        confidence: parsed.insufficientEvidence ? 0.85 : 0.9,
    };
};

export const invokeComposeEnumeration = (input: {
    hits: KnowledgeHit[];
    language: "zh" | "en" | "mixed";
    topics: string[];
    label: string;
    enumerationMeta: PipelineGraphState["enumerationMeta"];
    notes: string | null;
    listIntent: RoutedIntakeDecision["listIntent"];
}): ToolRunResult => {
    const result = composeEnumerationAnswer({
        hits: input.hits,
        language: input.language,
        topics: input.topics,
        label: input.label,
        enumerationMeta: input.enumerationMeta,
        notes: input.notes,
        listIntent: input.listIntent,
    });
    return analystToToolResult(
        "compose_enumeration",
        input.label,
        result,
        input.hits
    );
};

export const invokeSynthesizeMerge = async (input: {
    label: string;
    deps: ToolRunResult[];
    userQuestion?: string;
}): Promise<ToolRunResult> => {
    const { buildSynthesizeMergeResult } = await import("../synthesize");
    return buildSynthesizeMergeResult(input);
};

export const invokeComputeTenure = (input: {
    hits: KnowledgeHit[];
    language: "zh" | "en" | "mixed";
    label: string;
    asOfDate: string;
    searchQuery?: string;
}): ToolRunResult => {
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
        toolId: "compute_tenure_from_hits",
        label: input.label,
        ok: !insufficientEvidence,
        answer,
        citations,
        hits: input.hits,
        insufficientEvidence,
        confidence: insufficientEvidence ? 0.85 : 0.92,
    };
};

export const invokeExtractIdentityField = (input: {
    hits: KnowledgeHit[];
    field: IntakeIdentityField;
    language: "zh" | "en" | "mixed";
    label: string;
}): ToolRunResult => {
    const extraction = extractIdentityFieldFromHits(input.hits, input.field);
    const { answer, insufficientEvidence } = buildIdentityFieldAnswer({
        field: input.field,
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
        toolId: "extract_identity_from_hits",
        label: input.label,
        ok: !insufficientEvidence,
        answer,
        citations,
        hits: input.hits,
        insufficientEvidence,
        confidence: insufficientEvidence ? 0.85 : 0.92,
    };
};

export const invokeExtractExternalLinks = (input: {
    hits: KnowledgeHit[];
    language: "zh" | "en" | "mixed";
    label: string;
}): ToolRunResult => {
    const scope = { label: input.label };
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
        toolId: "extract_external_links_from_hits",
        label: input.label,
        ok: !insufficientEvidence,
        answer,
        citations,
        hits: input.hits,
        insufficientEvidence,
        confidence: insufficientEvidence ? 0.85 : 0.9,
    };
};

export const runExecutionPlanNode = async (
    node: ExecutionPlanNode,
    ctx: {
        state: PipelineGraphState;
        prior: PipelineToolResults;
    }
): Promise<ToolRunResult> => {
    const { state, prior } = ctx;
    const { corpusUserId, actorUserId } = state.context;
    const language = state.decision?.language ?? "zh";

    switch (node.toolId) {
        case "retrieve_corpus": {
            const retrieved = await invokeRetrieveCorpus({
                corpusUserId,
                actorUserId,
                searchQuery: node.searchQuery ?? state.userQuestion,
                queryType: node.queryType,
                topics: node.topics,
                subTasks: [node.label],
            });
            const answer =
                retrieved.hits.length > 0
                    ? retrieved.hits
                          .slice(0, 3)
                          .map((h) => `${h.title}：${h.excerpt.slice(0, 120)}`)
                          .join("\n")
                    : "语料未检索到相关内容。";
            return {
                toolId: "retrieve_corpus",
                label: node.label,
                ok: retrieved.hits.length > 0,
                answer,
                citations: dedupeCitations(
                    retrieved.hits.slice(0, 3).map((h) => ({
                        path: h.path,
                        excerpt: h.excerpt,
                    }))
                ),
                hits: retrieved.hits,
                insufficientEvidence: retrieved.hits.length === 0,
                confidence: retrieved.hits.length > 0 ? 0.75 : 0.85,
            };
        }
        case "search_web":
            return invokeSearchWeb({
                corpusUserId,
                actorUserId,
                query: node.webQuery ?? node.searchQuery ?? state.userQuestion,
            });
        case "translate_text": {
            const text =
                node.searchQuery?.trim() ||
                state.userQuestion.trim() ||
                "";
            const targetLang = node.targetLang?.trim() || "";
            return invokeTranslateText({
                corpusUserId,
                actorUserId,
                text,
                targetLang,
                sourceLang: node.sourceLang ?? "auto",
                label: node.label,
            });
        }
        case "compute_age_from_hits": {
            const hits = node.hitsOverride ?? state.hits;
            return invokeComputeAge({
                corpusUserId,
                actorUserId,
                hits,
                asOfDate: state.asOfDate ?? new Date().toISOString().slice(0, 10),
                language,
                label: node.label,
            });
        }
        case "compute_tenure_from_hits":
            return invokeComputeTenure({
                hits: node.hitsOverride ?? state.hits,
                language,
                label: node.label,
                searchQuery: node.searchQuery,
                asOfDate:
                    state.asOfDate ?? new Date().toISOString().slice(0, 10),
            });
        case "extract_identity_from_hits": {
            const field = (node.field as IntakeIdentityField | null) ?? "name";
            const resolvedField =
                (
                    [
                        "name",
                        "age",
                        "birthYear",
                        "email",
                        "phone",
                        "education",
                        "career",
                        "tenure",
                    ] as const
                ).includes(field as IntakeIdentityField)
                    ? (field as IntakeIdentityField)
                    : "name";
            return invokeExtractIdentityField({
                hits: node.hitsOverride ?? state.hits,
                field: resolvedField,
                language,
                label: node.label,
            });
        }
        case "extract_external_links_from_hits":
            return invokeExtractExternalLinks({
                hits: node.hitsOverride ?? state.hits,
                language,
                label: node.label,
            });
        case "list_corpus_entries": {
            // 取数主路径在 plan-fanout 每槽工人；此处作兜底（无 hits 时）
            const { retrieveEnumerationPage } = await import(
                "@/agentflow/agents/online/corpus-lister"
            );
            const listKind =
                (node.topics ?? []).some((t) => /^project/i.test(t))
                    ? "project"
                    : "experience";
            const page = 1;
            const pageSize = 20;
            const retrieval = await retrieveEnumerationPage({
                corpusUserId,
                listKind,
                page,
                pageSize,
            });
            return invokeComposeEnumeration({
                hits: retrieval.hits,
                language,
                topics: node.topics ?? [listKind],
                label: node.label,
                enumerationMeta: retrieval.enumerationMeta ?? null,
                notes: retrieval.notes,
                listIntent: "exhaustive",
            });
        }
        case "compose_enumeration":
            return invokeComposeEnumeration({
                hits: node.hitsOverride ?? state.hits,
                language,
                topics: node.topics ?? state.decision?.topics ?? [],
                label: node.label,
                enumerationMeta:
                    node.enumerationMetaOverride ?? state.enumerationMeta,
                notes: state.notes,
                listIntent: state.decision?.listIntent ?? null,
            });
        case "synthesize_merge": {
            const deps = node.deps.map((id) => prior[id]).filter(Boolean) as ToolRunResult[];
            return invokeSynthesizeMerge({
                label: node.label,
                deps,
                userQuestion: state.userQuestion,
            });
        }
        default:
            return {
                toolId: node.toolId,
                label: node.label,
                ok: false,
                answer: `未知工具：${node.toolId}`,
                citations: [],
                hits: [],
                insufficientEvidence: true,
                confidence: 0.5,
            };
    }
};

export const resolvePostRetrievalToolRuns = (
    state: PipelineGraphState
): Array<{ key: string; node: ExecutionPlanNode }> => {
    const decision = state.decision;
    if (!decision) return [];

    const runs: Array<{ key: string; node: ExecutionPlanNode }> = [];
    const enrichedSlots = (decision.compositeSlots ?? []) as Array<
        (typeof decision.compositeSlots)[number] & {
            toolId?: ToolRunId | null;
            dataSource?: string;
            field?: string | null;
        }
    >;

    if (
        state.compositeSubResults
    ) {
        for (const sub of state.compositeSubResults) {
            const slot = enrichedSlots.find((s) => s.id === sub.slot);
            // 仅 post-retrieval：mem/tool/summarize 工人已处理；无 hits 不跑
            if (
                !slot?.toolId ||
                !isPostRetrievalToolId(slot.toolId) ||
                slot.executor === "mem_recall" ||
                slot.executor === "tool_run" ||
                slot.executor === "summarize_slot" ||
                slot.dataSource === "mem0" ||
                slot.dataSource === "user_text" ||
                sub.hits.length === 0 ||
                sub.coverage === "none"
            ) {
                continue;
            }
            runs.push({
                key: `slot_${sub.slot}`,
                node: {
                    id: sub.slot,
                    label: sub.label,
                    searchQuery: slot.searchQuery,
                    dataSource:
                        slot.toolId === "compute_age_from_hits" ||
                        slot.toolId === "compute_tenure_from_hits"
                            ? "compute"
                            : "corpus",
                    toolId: slot.toolId,
                    queryType: slot.queryType,
                    topics: slot.topics,
                    field: slot.field ?? slot.identityField ?? null,
                    deps: [],
                    hitsOverride: sub.hits,
                    enumerationMetaOverride: sub.enumerationMeta ?? null,
                },
            });
        }
        return runs;
    }

    // 非 slots 兜底：信 enrichedPlan / pathPlan.tool（web 由槽 topics.external 或 pathPlan 表达）
    const enriched =
        decision.enrichedPlan ??
        (decision.retrievalPlan ?? []).map((p) => ({
            ...p,
            dataSource: "corpus" as const,
            field:
                resolveIdentityField(p.label, p.identityField)?.id ?? null,
            toolId: null as ToolRunId | null,
        }));

    const enumItem = enriched.find(
        (p) => p.toolId === "compose_enumeration" || p.queryType === "enumeration"
    );
    if (enumItem && state.hits.length > 0 && decision.queryType === "enumeration") {
        runs.push({
            key: "enumeration",
            node: {
                id: "enumeration",
                label: enumItem.label,
                dataSource: "corpus",
                toolId: "compose_enumeration",
                queryType: "enumeration",
                topics: enumItem.topics,
                deps: [],
            },
        });
    }

    const ageFromPlan = (decision.retrievalPlan ?? []).find(
        (p) => p.identityField === "age"
    );
    const ageItem =
        enriched.find((p) => p.toolId === "compute_age_from_hits") ??
        (decision.queryType === "identity" && ageFromPlan
            ? {
                  label: ageFromPlan.label || "年龄",
                  toolId: "compute_age_from_hits" as const,
                  field: "age",
              }
            : null);

    if (
        ageItem &&
        state.hits.length > 0 &&
        state.coverage !== "none"
    ) {
        runs.push({
            key: "age",
            node: {
                id: "age",
                label: ageItem.label ?? "年龄",
                dataSource: "compute",
                toolId: "compute_age_from_hits",
                field: "age",
                deps: [],
            },
        });
    }

    return runs;
};
