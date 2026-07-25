import { describe, expect, it } from "vitest";
import { sliceHitsForAnalystStream } from "@/agentflow/agents/online/information-analyst/analyst-recall-limits";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";

const hits = (n: number): KnowledgeHit[] =>
    Array.from({ length: n }, (_, i) => ({
        path: `p/${i}.md`,
        title: `item-${i}`,
        excerpt: "x",
        relevance: 1,
    }));

describe("sliceHitsForAnalystStream", () => {
    it("keeps full enumeration page by enumerationMeta.pageSize", () => {
        const sliced = sliceHitsForAnalystStream("enumeration", hits(24), {
            enumerationMeta: {
                listKind: "project",
                totalExpected: 36,
                shown: 16,
                page: 2,
                pageSize: 20,
                hasMore: false,
            },
            listIntent: "continue",
        });
        expect(sliced).toHaveLength(20);
    });

    it("falls back to profile maxHits when no pageSize", () => {
        const sliced = sliceHitsForAnalystStream("enumeration", hits(12), {});
        expect(sliced).toHaveLength(8);
    });
});
