import type { InformationAnalystResult } from "@/agentflow/agents/online/information-analyst/prompt";
import { resolveAnalystQueryProfile } from "@/agentflow/agents/online/information-analyst/analyst-recall-limits";
import type { SubQuestionAnalyzeInput } from "@/agentflow/agents/online/information-analyst/analyze-helpers";
import { resolveIdentityField } from "../catalog";
import type { PipelineToolResults, ToolRunResult } from "../interface";

export const toolRunToAnalystResult = (
    run: ToolRunResult
): InformationAnalystResult => ({
    answer: run.answer,
    citations: run.citations,
    confidence: run.confidence,
    insufficientEvidence: run.insufficientEvidence,
    blocks: run.blocks,
});

export const pickToolResultForSubQuestion = (
    input: SubQuestionAnalyzeInput,
    toolResults?: PipelineToolResults | null
): ToolRunResult | null => {
    if (!toolResults) return null;

    if (input.slotId) {
        const slotRun = toolResults[`slot_${input.slotId}`];
        if (slotRun) return slotRun;
    }

    const profile =
        input.queryType ??
        resolveAnalystQueryProfile({
            userQuestion: input.userQuestion,
            subTasks: [input.userQuestion],
        });

    if (profile === "enumeration" && toolResults.enumeration) {
        return toolResults.enumeration;
    }

    const identitySpec = resolveIdentityField(
        input.userQuestion,
        input.identityField
    );
    if (
        profile === "identity" &&
        identitySpec?.toolId === "extract_identity_from_hits"
    ) {
        const slotRun = input.slotId
            ? toolResults[`slot_${input.slotId}`]
            : null;
        if (slotRun?.toolId === "extract_identity_from_hits") return slotRun;
    }

    if (
        profile === "identity" &&
        (input.identityField === "age" ||
            input.facetKey === "id:age" ||
            identitySpec?.toolId === "compute_age_from_hits") &&
        toolResults.age
    ) {
        return toolResults.age;
    }

    if (profile === "external_link" && input.slotId) {
        const slotRun = toolResults[`slot_${input.slotId}`];
        if (slotRun?.toolId === "extract_external_links_from_hits") {
            return slotRun;
        }
    }

    // L4：hybrid 匹配结构化 —— 直接消费 synthesize_merge，禁止 Analyst 散文覆盖
    const synthesis = toolResults.synthesis;
    if (
        synthesis?.toolId === "synthesize_merge" &&
        (synthesis.matchReport || synthesis.answer.includes("## 匹配点"))
    ) {
        return synthesis;
    }
    if (input.slotId) {
        const dagRun = toolResults[input.slotId];
        if (
            dagRun?.toolId === "synthesize_merge" &&
            (dagRun.matchReport || dagRun.answer.includes("## 匹配点"))
        ) {
            return dagRun;
        }
    }

    if (toolResults.web) return toolResults.web;

    return null;
};
