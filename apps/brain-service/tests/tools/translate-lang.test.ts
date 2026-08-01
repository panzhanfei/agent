import { describe, expect, it } from "vitest";
import {
  legalizeYoudaoSourceLang,
  legalizeYoudaoTargetLang,
} from "@/agentflow/tools/translate";
import { normalizeStructuredFactValue } from "@fambrain/brain-memory";

describe("legalizeYoudaoTargetLang", () => {
  it("maps common codes", () => {
    expect(legalizeYoudaoTargetLang("en")).toBe("en");
    expect(legalizeYoudaoTargetLang("zh")).toBe("zh-CHS");
    expect(legalizeYoudaoTargetLang("zh-CN")).toBe("zh-CHS");
    expect(legalizeYoudaoTargetLang("ja")).toBe("ja");
  });

  it("rejects unknown codes", () => {
    expect(legalizeYoudaoTargetLang("xx")).toBeNull();
    expect(legalizeYoudaoTargetLang("")).toBeNull();
    expect(legalizeYoudaoTargetLang(null)).toBeNull();
  });
});

describe("legalizeYoudaoSourceLang", () => {
  it("defaults to auto", () => {
    expect(legalizeYoudaoSourceLang(undefined)).toBe("auto");
    expect(legalizeYoudaoSourceLang("auto")).toBe("auto");
    expect(legalizeYoudaoSourceLang("bogus")).toBe("auto");
  });
});

describe("normalizeStructuredFactValue", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeStructuredFactValue("  a  b\n c  ")).toBe("a b c");
  });
});
