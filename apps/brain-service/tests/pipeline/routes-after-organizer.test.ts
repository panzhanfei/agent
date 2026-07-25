import { describe, expect, it } from "vitest";
import { routeAfterContentOrganizer } from "@/agentflow/pipeline/graph/routes";
import { emptyPathPlan } from "@/agentflow/agents/online/intake-coordinator/path-plan";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

const baseState = (): PipelineGraphState =>
    ({
        decision: {
            intent: "retrieve_and_answer",
            composeMode: "qa",
            searchQuery: "项目",
            queryType: "enumeration",
            subTasks: [],
            topics: ["project"],
            language: "zh",
            confidence: 0.9,
            clarifyingQuestion: null,
            briefReply: null,
            retrievalPlan: [],
            pathPlan: emptyPathPlan(),
            answerOrder: [],
            userFactKey: null,
            userFactLabel: null,
            userFactValue: null,
            routeMode: "listRetriever",
            compositeSlots: [],
            routeReason: null,
            routePlanSource: null,
        },
        error: null,
    }) as PipelineGraphState;

describe("routeAfterContentOrganizer", () => {
    it("routes list/qa to analyst", () => {
        expect(routeAfterContentOrganizer(baseState())).toBe("analyst");
    });

    it("routes summarize compose to contentSummarizer", () => {
        const state = baseState();
        state.decision = {
            ...state.decision!,
            intent: "summarize_content",
            composeMode: "summarize",
        };
        expect(routeAfterContentOrganizer(state)).toBe("contentSummarizer");
    });
});
