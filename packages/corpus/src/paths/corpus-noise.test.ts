import { describe, expect, it } from "vitest";
import { isCorpusNoisePath } from "./corpus-noise";

describe("isCorpusNoisePath", () => {
  it("skips README and templates", () => {
    expect(isCorpusNoisePath("data/doc/u/corpus/experience/README.md")).toBe(
      true
    );
    expect(
      isCorpusNoisePath("data/doc/u/corpus/projects/_TEMPLATE.md")
    ).toBe(true);
    expect(
      isCorpusNoisePath("data/doc/u/corpus/personal/个人简历.md")
    ).toBe(false);
  });
});
