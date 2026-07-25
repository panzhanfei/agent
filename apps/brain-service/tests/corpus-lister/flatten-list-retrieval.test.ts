import { describe, expect, it } from "vitest";
import { flattenListRetrieval } from "@/agentflow/agents/online/corpus-lister/flatten-list-retrieval";

describe("flattenListRetrieval", () => {
    it("passes through single slot", () => {
        const flat = flattenListRetrieval([
            {
                hits: [{ path: "a.md", title: "a", excerpt: "x", relevance: 1 }],
                coverage: "partial",
                notes: "列举分页 1：1/3 个项目",
                enumerationMeta: {
                    listKind: "project",
                    totalExpected: 3,
                    shown: 1,
                    page: 1,
                    pageSize: 8,
                    hasMore: true,
                },
            },
        ]);
        expect(flat.hits).toHaveLength(1);
        expect(flat.enumerationMeta?.page).toBe(1);
        expect(flat.notes).toContain("1/3");
    });

    it("returns empty when no slots", () => {
        const flat = flattenListRetrieval([]);
        expect(flat.coverage).toBe("none");
        expect(flat.hits).toHaveLength(0);
    });
});
