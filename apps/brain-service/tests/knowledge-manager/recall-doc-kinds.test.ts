import { describe, expect, it } from "vitest";
import { recallDocKindsForQuery } from "@/agentflow/agents/online/knowledge-manager/profile/recall-doc-kinds";

describe("recallDocKindsForQuery", () => {
    it("identity name/phone/age and missing field → identity_card only", () => {
        expect(recallDocKindsForQuery("identity", "name")).toEqual([
            "identity_card",
        ]);
        expect(recallDocKindsForQuery("identity", "phone")).toEqual([
            "identity_card",
        ]);
        expect(recallDocKindsForQuery("identity", "age")).toEqual([
            "identity_card",
        ]);
        expect(recallDocKindsForQuery("identity", null)).toEqual([
            "identity_card",
        ]);
        expect(recallDocKindsForQuery("identity")).toEqual(["identity_card"]);
    });

    it("identity tenure/career → identity_card + experience", () => {
        expect(recallDocKindsForQuery("identity", "tenure")).toEqual([
            "identity_card",
            "experience",
        ]);
        expect(recallDocKindsForQuery("identity", "career")).toEqual([
            "identity_card",
            "experience",
        ]);
    });

    it("tech → project + experience", () => {
        expect(recallDocKindsForQuery("tech")).toEqual(["project", "experience"]);
    });

    it("enumeration uses listKind when present", () => {
        expect(recallDocKindsForQuery("enumeration", null, "experience")).toEqual(
            ["experience"]
        );
        expect(recallDocKindsForQuery("enumeration", null, "project")).toEqual([
            "project",
        ]);
        expect(recallDocKindsForQuery("enumeration")).toEqual([
            "experience",
            "project",
        ]);
    });

    it("external_link → project + experience + identity_card", () => {
        expect(recallDocKindsForQuery("external_link")).toEqual([
            "project",
            "experience",
            "identity_card",
        ]);
    });

    it("relations → relations docKind only", () => {
        expect(recallDocKindsForQuery("relations")).toEqual(["relations"]);
        expect(recallDocKindsForQuery("relations", "name")).toEqual([
            "relations",
        ]);
    });

    it("identity name without family still identity_card only", () => {
        expect(recallDocKindsForQuery("identity", "name")).toEqual([
            "identity_card",
        ]);
    });

    it("default / missing queryType → no filter", () => {
        expect(recallDocKindsForQuery("default")).toBeNull();
        expect(recallDocKindsForQuery(null)).toBeNull();
        expect(recallDocKindsForQuery(undefined)).toBeNull();
        expect(
            recallDocKindsForQuery("default", null, null, ["aky"])
        ).toBeNull();
        expect(
            recallDocKindsForQuery("default", null, null, ["personal"])
        ).toBeNull();
    });

    it("default 只信槽柜标签 → docKind（不覆盖已有 queryType）", () => {
        expect(
            recallDocKindsForQuery("default", null, null, ["aky", "experience"])
        ).toEqual(["experience"]);
        expect(
            recallDocKindsForQuery("default", null, null, ["career"])
        ).toEqual(["experience"]);
        expect(
            recallDocKindsForQuery("default", null, null, ["project"])
        ).toEqual(["project"]);
        expect(
            recallDocKindsForQuery("default", null, null, [
                "experience",
                "project",
            ])
        ).toEqual(["experience", "project"]);
        expect(
            recallDocKindsForQuery("default", null, null, ["family"])
        ).toEqual(["relations"]);
        expect(
            recallDocKindsForQuery("identity", "name", null, ["experience"])
        ).toEqual(["identity_card"]);
        expect(
            recallDocKindsForQuery("tech", null, null, ["experience"])
        ).toEqual(["project", "experience"]);
    });
});
