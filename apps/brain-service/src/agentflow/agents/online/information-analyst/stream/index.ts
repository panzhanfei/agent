import { getBrainServiceConfig } from "@fambrain/brain-config";
import { logAgentIn, logAgentOut } from "@fambrain/brain-shared/agent-log";
import { estimateTokenUsage, recordPipelineTokenUsage, } from "@fambrain/brain-shared/pipeline-run-context";
import { streamOllamaNative } from "@fambrain/brain-shared/ollama-native-stream";
import { parseJsonObject } from "@/agentflow/utils";
import {
    prefersPlainTextAnalystStream,
    resolveAnalystQueryProfile,
    sliceHitsForAnalystStream,
} from "../limits";
import {
    buildFallbackAnswer,
    normalizeAnalystResult,
    shouldSkipAnalystLlm,
    toSubQuestionInput,
} from "../analyze";
import { streamAnalyzeSubQuestion } from "./complete-analyze";
import { prompt } from "../contract";
import type {
    InformationAnalystInput,
    InformationAnalystResult,
} from "../interface";
import { cachedFacetToAnalystResult } from "@/agentflow/cache";
import { streamCompositeAnalyze } from "./stream-composite";
import type { AssistantMessageBlock } from "@fambrain/brain-types";

export {
    completeAnalyzeSubQuestion,
    maxAnalystHitsForProfile,
    MAX_SUB_QUESTION_HITS,
    streamAnalyzeSubQuestion,
} from "./complete-analyze";
export { streamCompositeAnalyze } from "./stream-composite";

type AnalystStreamChunk =
    | { type: "thinking"; text: string }
    | { type: "assistant"; text: string }
    | { type: "ui_block"; block: AssistantMessageBlock };

const useCompositeParallelAnalyze = (
    input: InformationAnalystInput
): input is InformationAnalystInput & {
    compositeSubResults: NonNullable<
        InformationAnalystInput["compositeSubResults"]
    >;
} => {
    const n = input.compositeSubResults?.length ?? 0;
    if (n < 1) return false;
    if (n >= 2) return true;
    // 单槽：composite 模式，或 mem/summarize 槽（无 corpus hits 也要走子问兜底）
    if (input.composeMode === "composite") return true;
    const sub = input.compositeSubResults![0]!;
    return Boolean(
        sub.dataSource === "mem0" ||
            sub.dataSource === "user_text" ||
            sub.recalledFact
    );
};

const resolveSingleSlotCachedAnswer = (
    input: InformationAnalystInput
): InformationAnalystResult | null => {
    const plan = input.compositeIncrementalPlan;
    if (!plan || plan.slots.length !== 1) return null;
    const slot = plan.slots[0]!;
    if (!slot.useCachedAnswer || !slot.cachedAnswer) return null;
    return cachedFacetToAnalystResult(slot.cachedAnswer);
};

/** 单问 plain-text 流式（与 composite 子问同路径，避免 JSON 解析失败 → excerpt 体） */
async function* streamSinglePlainAnalyze(
    input: InformationAnalystInput,
    profile: ReturnType<typeof resolveAnalystQueryProfile>
): AsyncGenerator<AnalystStreamChunk, InformationAnalystResult> {
    const hits = sliceHitsForAnalystStream(profile, input.hits, {
        enumerationMeta: input.enumerationMeta,
        listIntent: input.listIntent,
    });
    const subInput = toSubQuestionInput(input, profile, hits);
    const gen = streamAnalyzeSubQuestion(subInput);
    let result: InformationAnalystResult | undefined;
    while (true) {
        const next = await gen.next();
        if (next.done) {
            result = next.value;
            break;
        }
        yield { type: "assistant", text: next.value.text };
    }
    logAgentOut("InformationAnalyst", "出去", {
        source: "plain_text_stream",
        queryType: profile,
        insufficientEvidence: result!.insufficientEvidence,
        confidence: result!.confidence,
        citationCount: result!.citations.length,
        answerPreview:
            result!.answer.length > 400
                ? `${result!.answer.slice(0, 400)}…`
                : result!.answer,
    });
    return result!;
}

/** 单问 / 单槽：流式 Analyst（tech 等仍走 JSON） */
async function* streamSingleAnalyze(
    input: InformationAnalystInput
): AsyncGenerator<AnalystStreamChunk, InformationAnalystResult> {
    // L4：匹配结构化已就绪 → 直接渲染，禁止再注入 notes 让 LLM 散文改写
    const synthesis = input.toolResults?.synthesis;
    if (
        synthesis?.toolId === "synthesize_merge" &&
        (synthesis.matchReport || synthesis.answer.includes("## 匹配点")) &&
        (input.compositeSubResults?.length ?? 0) <= 1
    ) {
        const { toolRunToAnalystResult } = await import("./pick-tool-result");
        const rendered = toolRunToAnalystResult(synthesis);
        logAgentOut("InformationAnalyst", "出去", {
            source: "synthesize_match_report",
            insufficientEvidence: rendered.insufficientEvidence,
            confidence: rendered.confidence,
            citationCount: rendered.citations.length,
            blockCount: rendered.blocks?.length ?? 0,
            answerPreview:
                rendered.answer.length > 400
                    ? `${rendered.answer.slice(0, 400)}…`
                    : rendered.answer,
        });
        yield { type: "assistant", text: rendered.answer };
        for (const block of rendered.blocks ?? []) {
            yield { type: "ui_block", block };
        }
        return rendered;
    }
    const l3Cached = resolveSingleSlotCachedAnswer(input);
    if (l3Cached) {
        logAgentOut("InformationAnalyst", "出去", {
            source: "facet_cache_l3",
            insufficientEvidence: l3Cached.insufficientEvidence,
            confidence: l3Cached.confidence,
            citationCount: l3Cached.citations.length,
            blockCount: l3Cached.blocks?.length ?? 0,
            answerPreview:
                l3Cached.answer.length > 400
                    ? `${l3Cached.answer.slice(0, 400)}…`
                    : l3Cached.answer,
        });
        yield { type: "assistant", text: l3Cached.answer };
        for (const block of l3Cached.blocks ?? []) {
            yield { type: "ui_block", block };
        }
        return l3Cached;
    }

    const profile = resolveAnalystQueryProfile({
        userQuestion: input.userQuestion,
        subTasks: input.subTasks,
        queryType: input.queryType,
        searchQuery: input.searchQuery,
    });
    const fallback = buildFallbackAnswer(input);
    const { ollama } = getBrainServiceConfig();

    if (shouldSkipAnalystLlm(input)) {
        logAgentOut("InformationAnalyst", "出去", {
            source: "rules_empty_hits_skip_llm",
            insufficientEvidence: fallback.insufficientEvidence,
            confidence: fallback.confidence,
            citationCount: 0,
            blockCount: fallback.blocks?.length ?? 0,
            answerPreview:
                fallback.answer.length > 400
                    ? `${fallback.answer.slice(0, 400)}…`
                    : fallback.answer,
        });
        yield { type: "assistant", text: fallback.answer };
        for (const block of fallback.blocks ?? []) {
            yield { type: "ui_block", block };
        }
        return fallback;
    }

    if (prefersPlainTextAnalystStream(profile)) {
        const result = yield* streamSinglePlainAnalyze(input, profile);
        for (const block of result.blocks ?? []) {
            yield { type: "ui_block", block };
        }
        return result;
    }

    try {
        const messages = [
            { role: "system", content: prompt },
            { role: "user", content: JSON.stringify(input, null, 2) },
        ];
        let fullContent = "";
        const gen = streamOllamaNative({
            messages,
            think: false,
            model: ollama.models.intakeCoordinator,
        });
        while (true) {
            const next = await gen.next();
            if (next.done) {
                const usage = next.value;
                if (usage) {
                    recordPipelineTokenUsage({
                        prompt: usage.promptTokens,
                        completion: usage.completionTokens,
                    }, { node: "analyst" });
                }
                else {
                    recordPipelineTokenUsage(estimateTokenUsage(JSON.stringify(messages), fullContent), {
                        estimated: true,
                        node: "analyst",
                    });
                }
                break;
            }
            const chunk = next.value;
            if (chunk.kind === "thinking") {
                yield { type: "thinking", text: chunk.fullText };
            }
            else {
                fullContent = chunk.fullText;
                yield { type: "assistant", text: chunk.fullText };
            }
        }
        const parsed = parseJsonObject<InformationAnalystResult>(fullContent);
        const result = normalizeAnalystResult(parsed, fallback);
        if (result.answer !== fullContent.trim()) {
            yield { type: "assistant", text: result.answer };
        }
        logAgentOut("InformationAnalyst", "出去", {
            source: parsed ? "llm_json" : "fallback_parse",
            queryType: profile,
            insufficientEvidence: result.insufficientEvidence,
            confidence: result.confidence,
            citationCount: result.citations.length,
            answerPreview:
                result.answer.length > 400
                    ? `${result.answer.slice(0, 400)}…`
                    : result.answer,
        });
        return result;
    } catch (e) {
        logAgentOut("InformationAnalyst", "出去", {
            source: "fallback",
            error: e instanceof Error ? e.message : String(e),
            insufficientEvidence: fallback.insufficientEvidence,
            answerPreview:
                fallback.answer.length > 400
                    ? `${fallback.answer.slice(0, 400)}…`
                    : fallback.answer,
        });
        yield { type: "assistant", text: fallback.answer };
        return fallback;
    }
}

/**
 * 信息分析师流式入口：
 * - composite ≥2 子问 → 并行分问 Analyst（stream-composite）
 * - 其余 → 单问流式 Analyst
 */
export async function* streamAnalyzeInformation(
    input: InformationAnalystInput
): AsyncGenerator<AnalystStreamChunk, InformationAnalystResult> {
    const profile = resolveAnalystQueryProfile({
        userQuestion: input.userQuestion,
        subTasks: input.subTasks,
        queryType: input.queryType,
        searchQuery: input.searchQuery,
    });

    logAgentIn("InformationAnalyst", "进入", {
        userQuestion: input.userQuestion,
        language: input.language,
        hitCount: input.hits.length,
        coverage: input.coverage,
        notes: input.notes,
        hasMemoryBlock: Boolean(input.memoryBlock),
        subTasks: input.subTasks,
        queryType: input.queryType ?? profile,
        routeMode: input.routeMode ?? "skip",
        compositeSlotCount: input.compositeSubResults?.length ?? 0,
        hitPaths: input.hits.map((h) => h.path),
        analyzeMode: useCompositeParallelAnalyze(input)
            ? "composite_sequential_stream"
            : prefersPlainTextAnalystStream(profile)
              ? "single_plain_stream"
              : "single_json",
    });

    if (useCompositeParallelAnalyze(input)) {
        return yield* streamCompositeAnalyze(input, input.compositeSubResults);
    }

    return yield* streamSingleAnalyze(input);
}
