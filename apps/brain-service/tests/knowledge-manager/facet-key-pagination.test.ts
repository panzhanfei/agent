import { describe, expect, it } from "vitest";
import {
    buildFacetKey,
    facetAnswerMatchesSlot,
} from "@/agentflow/agents/online/knowledge-manager/composite/facet-key";
import type { CachedFacetAnswer } from "@fambrain/infra";

describe("buildFacetKey pagination", () => {
    it("scopes list_corpus exhaustive/continue by enumerationPage", () => {
        const base = {
            label: "列举项目",
            searchQuery: "项目经历 全部项目",
            queryType: "enumeration" as const,
            topics: ["project"],
            executor: "list_corpus" as const,
            enumerationControl: {
                action: "exhaustive" as const,
                listKind: "project" as const,
            },
        };
        expect(
            buildFacetKey({ ...base, enumerationPage: 1 })
        ).toBe("enum:projects:p1");
        expect(
            buildFacetKey({
                ...base,
                enumerationPage: 2,
                enumerationControl: {
                    action: "continue",
                    listKind: "project",
                },
            })
        ).toBe("enum:projects:p2");
    });

    it("keeps preview enumeration without page suffix", () => {
        expect(
            buildFacetKey({
                label: "项目",
                searchQuery: "x",
                queryType: "enumeration",
                topics: ["project"],
                enumerationControl: {
                    action: "preview",
                    listKind: "project",
                },
            })
        ).toBe("enum:projects");
    });
});

describe("facetAnswerMatchesSlot", () => {
    const cached = (page: number): CachedFacetAnswer => ({
        facetKey: "enum:projects:p2",
        label: "项目",
        answer: "x",
        citations: [],
        coverage: "partial",
        insufficientEvidence: false,
        confidence: 0.75,
        cachedAt: Date.now(),
        enumerationPage: page,
        listKind: "project",
    });

    it("rejects cache when list page differs", () => {
        expect(
            facetAnswerMatchesSlot(cached(1), {
                id: "list-projects",
                label: "项目",
                searchQuery: "x",
                queryType: "enumeration",
                topics: ["project"],
                subTasks: [],
                executor: "list_corpus",
                enumerationPage: 2,
                enumerationControl: {
                    action: "continue",
                    listKind: "project",
                },
            })
        ).toBe(false);
    });

    it("accepts cache when list page matches", () => {
        expect(
            facetAnswerMatchesSlot(cached(2), {
                id: "list-projects",
                label: "项目",
                searchQuery: "x",
                queryType: "enumeration",
                topics: ["project"],
                subTasks: [],
                executor: "list_corpus",
                enumerationPage: 2,
                enumerationControl: {
                    action: "continue",
                    listKind: "project",
                },
            })
        ).toBe(true);
    });
});
