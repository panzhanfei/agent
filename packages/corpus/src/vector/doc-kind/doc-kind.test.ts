import { describe, expect, it } from "vitest";
import { inferCorpusDocKind } from "./infer";

describe("inferCorpusDocKind", () => {
    it("experience/ is experience", () => {
        expect(
            inferCorpusDocKind(
                "data/doc/users/u/corpus/experience/2021-西安奥卡云.md",
                "# 奥卡云"
            )
        ).toBe("experience");
    });

    it("projects/ is project including resume.md", () => {
        expect(
            inferCorpusDocKind(
                "data/doc/users/u/corpus/projects/resume.md",
                "## 我的角色"
            )
        ).toBe("project");
    });

    it("personal single 姓名 card is identity_card", () => {
        expect(
            inferCorpusDocKind(
                "data/doc/users/u/corpus/personal/个人简历.md",
                "| 项 | 内容 |\n| 姓名 | 潘展飞 |\n| 电话 | 136 |\n"
            )
        ).toBe("identity_card");
    });

    it("personal multi-name roster is relations", () => {
        expect(
            inferCorpusDocKind(
                "data/doc/users/u/corpus/personal/亲友关系.md",
                "| 称呼 | 姓名 |\n| --- | --- |\n| 哥哥 | 潘小强 |\n| 嫂子 | 乔乔 |\n"
            )
        ).toBe("relations");
    });

    it("personal/imports (vault materialize) is uncategorized", () => {
        expect(
            inferCorpusDocKind(
                "users/u/corpus/personal/imports/workspace/notes/a.md",
                "| 姓名 | 某人 |\n"
            )
        ).toBe("uncategorized");
    });

    it("other paths are uncategorized", () => {
        expect(
            inferCorpusDocKind("data/doc/users/u/corpus/notes/foo.md", "hello")
        ).toBe("uncategorized");
    });
});
