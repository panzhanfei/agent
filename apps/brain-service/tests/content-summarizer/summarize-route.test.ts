import { describe, expect, it } from "vitest";
import {
    isPureSummarizeDecision,
    isSummarizeComposeDecision,
} from "@/agentflow/agents/online/content-summarizer/summarize-route";
import { emptyPathPlan } from "@/agentflow/agents/online/intake-coordinator/path-plan";

describe("summarize-route", () => {
    it("detects pure summarize without retrieval", () => {
        const decision = {
            intent: "summarize_content" as const,
            composeMode: "summarize" as const,
            searchQuery: "",
            pathPlan: emptyPathPlan(),
            topics: [],
            subTasks: [],
            language: "zh" as const,
            confidence: 0.9,
            queryType: null,
            clarifyingQuestion: null,
            briefReply: null,
            retrievalPlan: [],
            userFactKey: null,
            userFactLabel: null,
            userFactValue: null,
            routeMode: "respondEarly" as const,
            compositeSlots: [],
            answerOrder: [],
            routeReason: undefined,
            routePlanSource: undefined,
        };
        expect(isPureSummarizeDecision(decision)).toBe(true);
    });

    it("requires planFanOut when summarize has searchQuery", () => {
        const decision = {
            intent: "summarize_content" as const,
            composeMode: "summarize" as const,
            searchQuery: "城管平台 技术栈",
            pathPlan: {
                steps: [
                    {
                        id: "km-0",
                        kind: "km" as const,
                        label: "摘要检索",
                        searchQuery: "城管平台 技术栈",
                        queryType: "tech" as const,
                        topics: [],
                    },
                ],
            },
            topics: [],
            subTasks: [],
            language: "zh" as const,
            confidence: 0.9,
            queryType: "tech" as const,
            clarifyingQuestion: null,
            briefReply: null,
            retrievalPlan: [],
            userFactKey: null,
            userFactLabel: null,
            userFactValue: null,
            routeMode: "respondEarly" as const,
            compositeSlots: [],
            answerOrder: ["km-0"],
            routeReason: undefined,
            routePlanSource: undefined,
        };
        expect(isPureSummarizeDecision(decision)).toBe(false);
        expect(isSummarizeComposeDecision(decision)).toBe(true);
    });
});
