import { describe, expect, it } from "vitest";
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import {
    findLastEnumerationBlock,
    resolveEnumerationPagination,
} from "@/agentflow/agents/online/intake-coordinator/enumeration";
import { ENUMERATION_EXHAUSTIVE_PAGE_SIZE } from "@/agentflow/agents/online/corpus-lister/list";

const previewBlock = (
    overrides: Partial<Extract<AssistantMessageBlock, { type: "enumeration" }>> = {}
): AssistantMessageBlock => ({
    type: "enumeration",
    listKind: "project",
    items: [],
    total: 36,
    shown: 8,
    page: 1,
    pageSize: 8,
    hasMore: true,
    startIndex: 1,
    ...overrides,
});

describe("resolveEnumerationPagination", () => {
    it("continue after preview block uses page+1 and same pageSize", () => {
        const history = [
            { role: "user" as const, content: "查看所有项目" },
            {
                role: "assistant" as const,
                content: "1. p1",
                blocks: [previewBlock()],
            },
            { role: "user" as const, content: "更多项目" },
        ];
        expect(
            resolveEnumerationPagination(
                { action: "continue", listKind: "project" },
                history
            )
        ).toEqual({ page: 2, pageSize: 8 });
    });

    it("continue without prior block starts paginated page 1", () => {
        expect(
            resolveEnumerationPagination(
                { action: "continue", listKind: "project" },
                [{ role: "user", content: "更多项目" }]
            )
        ).toEqual({ page: 1, pageSize: ENUMERATION_EXHAUSTIVE_PAGE_SIZE });
    });

    it("exhaustive always uses full page size", () => {
        const history = [
            {
                role: "assistant" as const,
                content: "preview",
                blocks: [previewBlock()],
            },
        ];
        expect(
            resolveEnumerationPagination(
                { action: "exhaustive", listKind: "project" },
                history
            )
        ).toEqual({ page: 1, pageSize: ENUMERATION_EXHAUSTIVE_PAGE_SIZE });
    });

    it("findLastEnumerationBlock skips unrelated listKind", () => {
        const history = [
            {
                role: "assistant" as const,
                content: "jobs",
                blocks: [
                    previewBlock({
                        listKind: "employer",
                        page: 2,
                        pageSize: 20,
                    }),
                ],
            },
        ];
        expect(findLastEnumerationBlock(history, "project")).toBeNull();
        expect(findLastEnumerationBlock(history, "experience")?.page).toBe(2);
    });
});
