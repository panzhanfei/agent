import { getBrainServiceConfig } from "@fambrain/brain-config";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { completeChat, streamChat, type ChatMessage } from "@fambrain/brain-shared/chat";
import { recordCompleteChatUsage } from "@fambrain/brain-shared/pipeline-run-context";
import { dedupeCitations } from "@/agentflow/agents/online/content-organizer";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";
import { parseJsonObject } from "@/agentflow/utils";
import {
    resolveAnalystQueryProfile,
    sliceHitsForAnalystStream,
} from "../limits";
import { resolveOrchestratedTool } from "@/agentflow/tools/local/orchestrated";
import { pickToolResultForSubQuestion } from "../pick-tool-result";
import {
    buildSubQuestionFallbackAnswer,
    normalizeAnalystResult,
    shouldSkipSubQuestionLlm,
    type SubQuestionAnalyzeInput,
} from "../analyze";
import {
    buildSubQuestionStreamPrompt,
    subQuestionPrompt,
} from "./sub-question-prompt";
import type { InformationAnalystResult } from "../interface";

type SubQuestionStreamChunk = { type: "assistant"; text: string };

const sliceHitsForAnalyst = (input: SubQuestionAnalyzeInput): KnowledgeHit[] => {
    const profile = resolveAnalystQueryProfile({
        userQuestion: input.userQuestion,
        queryType: input.queryType,
    });
    return sliceHitsForAnalystStream(profile, input.hits, {
        enumerationMeta: input.enumerationMeta,
        listIntent: input.listIntent,
    });
};

const buildSubQuestionResult = (
    input: SubQuestionAnalyzeInput,
    answer: string,
    insufficientEvidence: boolean
): InformationAnalystResult => {
    const hits = sliceHitsForAnalyst(input);
    const citations = insufficientEvidence
        ? []
        : dedupeCitations(
              hits.slice(0, 3).map((h) => ({
                  path: h.path,
                  excerpt: h.excerpt,
              }))
          );
    return {
        answer: answer.trim(),
        citations,
        confidence: insufficientEvidence ? 0.85 : 0.75,
        insufficientEvidence,
    };
};

/** 单个子问题流式 Analyst（composite 顺序段 / 单问 plain-text 共用） */
export async function* streamAnalyzeSubQuestion(
    input: SubQuestionAnalyzeInput
): AsyncGenerator<SubQuestionStreamChunk, InformationAnalystResult> {
    const profile = resolveAnalystQueryProfile({
        userQuestion: input.userQuestion,
        queryType: input.queryType,
    });
    const hits = sliceHitsForAnalyst(input);
    const payload = {
        ...input,
        hits,
        queryType: profile,
        topics: input.topics ?? [],
        asOfDate: input.asOfDate ?? new Date().toISOString().slice(0, 10),
    };
    const fallback = await buildSubQuestionFallbackAnswer(payload);

    if (shouldSkipSubQuestionLlm(payload)) {
        const toolId =
            pickToolResultForSubQuestion(payload, payload.toolResults)?.toolId ??
            resolveOrchestratedTool(payload);
        logAgentOut("InformationAnalyst", "子问流式出去", {
            label: input.userQuestion,
            source: toolId
                ? `orchestrated_${toolId}`
                : "rules_empty_hits_skip_llm",
            hitCount: hits.length,
            answerPreview:
                fallback.answer.length > 120
                    ? `${fallback.answer.slice(0, 120)}…`
                    : fallback.answer,
        });
        yield { type: "assistant", text: fallback.answer };
        return fallback;
    }

    let fullContent = "";
    const promptMessages: ChatMessage[] = [
        {
            role: "system",
            content: buildSubQuestionStreamPrompt(profile, payload.topics),
        },
        { role: "user", content: JSON.stringify(payload) },
    ];
    try {
        const gen = streamChat({
            messages: promptMessages,
            jsonMode: false,
            thinking: "disabled",
        });
        while (true) {
            const next = await gen.next();
            if (next.done) {
                recordCompleteChatUsage(next.value, {
                    promptText: JSON.stringify(promptMessages),
                    completionText: fullContent,
                    node: "analyst",
                });
                break;
            }
            const chunk = next.value;
            if (chunk.kind !== "content") continue;
            fullContent = chunk.fullText.trim();
            if (fullContent) {
                yield { type: "assistant", text: fullContent };
            }
        }
        const answer = fullContent || fallback.answer;
        const result = buildSubQuestionResult(
            payload,
            answer,
            hits.length === 0 || input.coverage === "none"
        );
        logAgentOut("InformationAnalyst", "子问流式出去", {
            label: input.userQuestion,
            queryType: profile,
            hitCount: hits.length,
            chatProvider: getBrainServiceConfig().chat.provider,
            answerPreview:
                result.answer.length > 120
                    ? `${result.answer.slice(0, 120)}…`
                    : result.answer,
        });
        return result;
    } catch (e) {
        logAgentOut("InformationAnalyst", "子问流式出去", {
            label: input.userQuestion,
            source: "fallback_error",
            error: e instanceof Error ? e.message : String(e),
        });
        yield { type: "assistant", text: fallback.answer };
        return fallback;
    }
}

/** 单个子问题非流式 Analyst（短路径 / 测试） */
export const completeAnalyzeSubQuestion = async (
    input: SubQuestionAnalyzeInput
): Promise<InformationAnalystResult> => {
    const profile = resolveAnalystQueryProfile({
        userQuestion: input.userQuestion,
        queryType: input.queryType,
    });
    const hits = sliceHitsForAnalyst(input);
    const payload = {
        ...input,
        hits,
        queryType: profile,
        asOfDate: input.asOfDate ?? new Date().toISOString().slice(0, 10),
    };
    const fallback = await buildSubQuestionFallbackAnswer(payload);

    if (shouldSkipSubQuestionLlm(payload)) {
        const toolId =
            pickToolResultForSubQuestion(payload, payload.toolResults)?.toolId ??
            resolveOrchestratedTool(payload);
        logAgentOut("InformationAnalyst", "子问出去", {
            label: input.userQuestion,
            source: toolId
                ? `orchestrated_${toolId}`
                : "rules_empty_hits_skip_llm",
            hitCount: hits.length,
            answerPreview:
                fallback.answer.length > 120
                    ? `${fallback.answer.slice(0, 120)}…`
                    : fallback.answer,
        });
        return fallback;
    }

    try {
        const promptText = `${subQuestionPrompt}\n${JSON.stringify(payload)}`;
        const resultChat = await completeChat({
            messages: [
                { role: "system", content: subQuestionPrompt },
                { role: "user", content: JSON.stringify(payload) },
            ],
            jsonMode: true,
            thinking: "disabled",
        });
        recordCompleteChatUsage(resultChat.usage, {
            promptText,
            completionText: resultChat.text,
            node: "analyst",
        });
        const parsed = parseJsonObject<InformationAnalystResult>(resultChat.text);
        const result = normalizeAnalystResult(parsed, fallback);
        logAgentOut("InformationAnalyst", "子问出去", {
            label: input.userQuestion,
            source: parsed ? "llm" : "fallback_parse",
            hitCount: hits.length,
            chatProvider: resultChat.provider,
            answerPreview:
                result.answer.length > 120
                    ? `${result.answer.slice(0, 120)}…`
                    : result.answer,
        });
        return result;
    } catch (e) {
        logAgentOut("InformationAnalyst", "子问出去", {
            label: input.userQuestion,
            source: "fallback_error",
            error: e instanceof Error ? e.message : String(e),
        });
        return fallback;
    }
};

export {
    maxAnalystHitsForProfile,
    MAX_SUB_QUESTION_HITS,
} from "../limits";
