import { describe, expect, it } from "vitest";
import {
    canonicalizePlanItem,
    dedupePlanByFacet,
    normalizePlanItemFromSchema,
} from "@/agentflow/agents/online/intake-coordinator";

describe("dedupePlanByFacet", () => {
    it("merges duplicate experience enumerations", () => {
        const deduped = dedupePlanByFacet([
            {
                label: "工作经历",
                searchQuery: "工作经历",
                queryType: "enumeration",
                topics: ["experience"],
                enumerationControl: {
                    action: "preview",
                    listKind: "experience",
                    excludeHint: null,
                },
            },
            {
                label: "任职公司及职位列举",
                searchQuery: "公司 职位",
                queryType: "enumeration",
                topics: ["experience"],
                enumerationControl: {
                    action: "exhaustive",
                    listKind: "experience",
                    excludeHint: null,
                },
            },
        ]);
        expect(deduped).toHaveLength(1);
        expect(deduped[0]?.enumerationControl?.action).toBe("exhaustive");
        expect(deduped[0]?.enumerationControl?.listKind).toBe("experience");
    });

    it("keeps project slots with different timeWindowYears", () => {
        const deduped = dedupePlanByFacet([
            {
                label: "近两年项目",
                searchQuery: "项目",
                queryType: "enumeration",
                topics: ["project"],
                enumerationControl: {
                    action: "preview",
                    listKind: "project",
                    excludeHint: null,
                    timeWindowYears: 2,
                },
            },
            {
                label: "全部项目",
                searchQuery: "项目",
                queryType: "enumeration",
                topics: ["project"],
                enumerationControl: {
                    action: "exhaustive",
                    listKind: "project",
                    excludeHint: null,
                    timeWindowYears: null,
                },
            },
        ]);
        expect(deduped).toHaveLength(2);
    });

    it("keeps career tenure and employer tenure as separate facets", () => {
        const deduped = dedupePlanByFacet([
            {
                label: "从业年限",
                searchQuery: "个人简介 简历 工作经历 时间线 任职 时间段",
                queryType: "identity",
                topics: ["personal", "resume", "experience"],
                identityField: "tenure",
            },
            {
                label: "西安奥卡云任职年限",
                searchQuery: "西安奥卡云 任职 年限 时间段",
                queryType: "identity",
                topics: ["experience"],
                identityField: "tenure",
            },
        ]);
        expect(deduped).toHaveLength(2);
    });
});

describe("normalizePlanItemFromSchema", () => {
    it("keeps non-empty LLM searchQuery; fills catalog when empty", () => {
        const kept = normalizePlanItemFromSchema({
            label: "从业年限",
            searchQuery: "随便",
            queryType: "identity",
            topics: [],
            identityField: "tenure",
        });
        expect(kept.searchQuery).toBe("随便");
        expect(kept.identityField).toBe("tenure");

        const filled = normalizePlanItemFromSchema({
            label: "从业年限",
            searchQuery: "  ",
            queryType: "identity",
            topics: [],
            identityField: "tenure",
        });
        expect(filled.searchQuery).toMatch(/时间线|工作经历/);
    });

    it("promotes identityField on default queryType to identity", () => {
        const item = normalizePlanItemFromSchema({
            label: "年龄",
            searchQuery: "年龄",
            queryType: "default",
            topics: [],
            identityField: "age",
        });
        expect(item.queryType).toBe("identity");
        expect(item.identityField).toBe("age");
    });

    it("keeps family + identityField as relations (does not promote back to identity)", () => {
        const fromIdentity = normalizePlanItemFromSchema({
            label: "哥哥姓名",
            searchQuery: "亲友关系 哥哥 姓名",
            queryType: "identity",
            topics: ["personal", "family"],
            identityField: "name",
        });
        expect(fromIdentity.queryType).toBe("relations");
        expect(fromIdentity.identityField).toBeNull();

        const alreadyRelations = normalizePlanItemFromSchema({
            label: "哥哥姓名",
            searchQuery: "亲友关系 哥哥 姓名",
            queryType: "relations",
            topics: ["personal", "family"],
            identityField: "name",
        });
        expect(alreadyRelations.queryType).toBe("relations");
        expect(alreadyRelations.identityField).toBeNull();
    });

    it("infers experience listKind from career topics when control incomplete", () => {
        const item = normalizePlanItemFromSchema({
            label: "公司与职位",
            searchQuery: "公司",
            queryType: "enumeration",
            topics: ["career"],
            enumerationControl: {
                action: "preview",
                listKind: "experience",
                excludeHint: null,
            },
        });
        expect(item.enumerationControl?.listKind).toBe("experience");
    });
});

describe("canonicalizePlanItem identityField", () => {
    it("keeps LLM searchQuery and topics when non-empty", () => {
        const item = canonicalizePlanItem({
            label: "从业年限",
            searchQuery: "个人简介 简历 工作经历 时间线 任职 时间段",
            queryType: "identity",
            topics: ["personal", "resume"],
            identityField: "tenure",
        });
        expect(item.searchQuery).toMatch(/时间线|工作经历/);
        expect(item.topics).toEqual(["personal", "resume"]);
        expect(item.identityField).toBe("tenure");
    });

    it("fills tenure template when searchQuery empty", () => {
        const item = canonicalizePlanItem({
            label: "从业年限",
            searchQuery: "",
            queryType: "identity",
            topics: [],
            identityField: "tenure",
        });
        expect(item.searchQuery).toMatch(/时间线|工作经历/);
        expect(item.topics).toContain("experience");
        expect(item.identityField).toBe("tenure");
    });
});
