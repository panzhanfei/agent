import { describe, expect, it } from "vitest";
import {
    buildAgeAnswer,
    computeAgeYears,
    extractBirthOrAgeFromText,
    extractIdentityFieldFromHits,
    isAgeSubQuestion,
} from "@/agentflow/tools/local/identity";

describe("compute-age", () => {
    it("extracts birth date from resume table", () => {
        const r = extractBirthOrAgeFromText("| 出生日期 | 1993.03 |");
        expect(r.birth?.year).toBe(1993);
        expect(r.birth?.month).toBe(3);
    });

    it("computes 周岁 from birth date", () => {
        const age = computeAgeYears(
            { year: 1993, month: 3 },
            new Date("2026-07-09T12:00:00")
        );
        expect(age).toBe(33);
    });

    it("detects age sub-questions", () => {
        expect(isAgeSubQuestion("我今年多大")).toBe(true);
        expect(isAgeSubQuestion("姓名叫什么")).toBe(false);
        expect(isAgeSubQuestion("出生年份")).toBe(false);
    });

    it("builds insufficient answer when no birth field", () => {
        const { answer, insufficientEvidence } = buildAgeAnswer({
            extraction: {},
            language: "zh",
            asOfDate: "2026-07-09",
        });
        expect(insufficientEvidence).toBe(true);
        expect(answer).toMatch(/未标注当前年龄/);
    });

    it("annotates asOf on computed age", () => {
        const { answer } = buildAgeAnswer({
            extraction: {
                birth: { year: 1993, month: 3 },
                birthLabel: "1993 年 3 月",
            },
            language: "zh",
            asOfDate: "2026-08-13",
        });
        expect(answer).toMatch(/33\s*岁/);
        expect(answer).toMatch(/截至 2026-08-13/);
    });

    it("extracts birthYear without computing age", () => {
        const found = extractIdentityFieldFromHits(
            [
                {
                    path: "personal/resume.md",
                    title: "简历",
                    excerpt: "| 出生日期 | 1993.03 |",
                    relevance: 1,
                },
            ],
            "birthYear"
        );
        expect(found?.value).toBe("1993");
    });
});
