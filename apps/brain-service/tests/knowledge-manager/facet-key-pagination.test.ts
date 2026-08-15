import { describe, expect, it } from "vitest";
import {
    buildFacetKey,
    facetAnswerMatchesSlot,
    facetKeyMatchesIdentity,
} from "@/agentflow/cache";
import type { CachedFacetAnswer } from "@fambrain/infra";

describe("buildFacetKey shape", () => {
    it("puts normalized searchQuery on identity keys so variants do not collide", () => {
        const base = {
            label: "年龄",
            queryType: "identity" as const,
            topics: ["personal"],
            identityField: "age" as const,
        };
        expect(buildFacetKey({ ...base, searchQuery: "今年多大" })).toBe(
            "id:age:今年多大"
        );
        expect(buildFacetKey({ ...base, searchQuery: "按农历多大" })).toBe(
            "id:age:按农历多大"
        );
        expect(buildFacetKey({ ...base, searchQuery: "  今年多大？ " })).toBe(
            "id:age:今年多大"
        );
    });

    it("keeps identityField in the bucket so age and name do not share a key", () => {
        expect(
            buildFacetKey({
                label: "姓名",
                searchQuery: "个人简介",
                queryType: "identity",
                topics: ["personal"],
                identityField: "name",
            })
        ).toBe("id:name:个人简介");
    });

    it("scopes list_corpus exhaustive/continue by searchQuery and page", () => {
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
        expect(buildFacetKey({ ...base, enumerationPage: 1 })).toBe(
            "enum:projects:项目经历 全部项目:p1"
        );
        expect(
            buildFacetKey({
                ...base,
                enumerationPage: 2,
                enumerationControl: {
                    action: "continue",
                    listKind: "project",
                },
            })
        ).toBe("enum:projects:项目经历 全部项目:p2");
    });

    it("scopes list_corpus preview by searchQuery and p1", () => {
        expect(
            buildFacetKey({
                label: "项目",
                searchQuery: "x",
                queryType: "enumeration",
                topics: ["project"],
                executor: "list_corpus",
                enumerationPage: 1,
                enumerationControl: {
                    action: "preview",
                    listKind: "project",
                },
            })
        ).toBe("enum:projects:x:p1");
    });
});

describe("facetKeyMatchesIdentity", () => {
    it("matches new and legacy age keys", () => {
        expect(facetKeyMatchesIdentity("id:age:今年多大", "age")).toBe(true);
        expect(facetKeyMatchesIdentity("id:age", "age")).toBe(true);
        expect(facetKeyMatchesIdentity("id:name:个人简介", "age")).toBe(false);
    });
});

describe("facetAnswerMatchesSlot", () => {
    const cached = (page: number): CachedFacetAnswer => ({
        facetKey: "enum:projects:x:p2",
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
