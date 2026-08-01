import { describe, expect, it } from "vitest";
import {
  buildMergedCoreferenceQuestion,
  normalizeIntakeUtterance,
  shouldRetryCoreferenceMerge,
  shouldShortCircuitIncompleteUtterance,
  surfaceForSingleCharSignal,
} from "@/agentflow/agents/online/intake-coordinator";

describe("normalizeIntakeUtterance", () => {
  it("collapses repeated punctuation/CJK but keeps latin letter runs", () => {
    expect(normalizeIntakeUtterance("呢呢呢？？？")).toBe("呢？");
    expect(normalizeIntakeUtterance("好好好")).toBe("好");
    expect(normalizeIntakeUtterance("  aaa  ")).toBe("aaa");
    expect(normalizeIntakeUtterance("我的qq是多少")).toBe("我的qq是多少");
  });

  it("does not collapse distinct characters", () => {
    expect(normalizeIntakeUtterance("那个项目呢？")).toBe("那个项目呢？");
  });
});

describe("shouldRetryCoreferenceMerge (deprecated, always no-op)", () => {
  it("never retries (Plan-level merge abolished)", () => {
    const history = [
      { role: "user" as const, content: "城管平台用了什么技术" },
      { role: "assistant" as const, content: "城市管理平台使用 React。" },
      { role: "user" as const, content: "那个项目呢？" },
    ];
    expect(
      shouldRetryCoreferenceMerge(
        { coreference: "unresolved" },
        "那个项目呢？",
        history
      ).retry
    ).toBe(false);
  });
});

describe("buildMergedCoreferenceQuestion", () => {
  it("joins with Chinese semicolon (helper retained for tests/scripts)", () => {
    expect(buildMergedCoreferenceQuestion("上轮", "本轮")).toBe("上轮；本轮");
  });
});

describe("shouldShortCircuitIncompleteUtterance", () => {
  it("short-circuits ack and lone punct without history", () => {
    expect(shouldShortCircuitIncompleteUtterance("嗯", [])).toBe(true);
    expect(shouldShortCircuitIncompleteUtterance("？", [])).toBe(true);
  });

  it("short-circuits repeated ack/punct spam after normalize", () => {
    expect(shouldShortCircuitIncompleteUtterance("嗯嗯嗯", [])).toBe(true);
    expect(shouldShortCircuitIncompleteUtterance("？？？", [])).toBe(true);
  });

  it("does not short-circuit multi-char questions", () => {
    expect(
      shouldShortCircuitIncompleteUtterance("那个项目呢？", [
        { role: "user", content: "城管平台" },
        { role: "assistant", content: "ok" },
        { role: "user", content: "那个项目呢？" },
      ])
    ).toBe(false);
  });
});

describe("surfaceForSingleCharSignal", () => {
  it("strips edge punct for single-char surface", () => {
    expect(surfaceForSingleCharSignal("呢？？")).toBe("呢");
  });
});
