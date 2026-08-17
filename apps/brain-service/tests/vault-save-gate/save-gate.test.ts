import { describe, expect, it } from "vitest";
import { parseIntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import {
  buildVaultSaveGateBlocks,
  parseVaultSaveResume,
  sanitizeVaultSaveBasename,
  shouldOfferVaultSaveGate,
  VAULT_SAVE_CANCEL_PROMPT,
  VAULT_SAVE_CONFIRM_PROMPT,
} from "@/agentflow/agents/online/vault-save-gate";
import {
  routeAfterAnalyst,
  routeAfterContentSummarizer,
} from "@/agentflow/pipeline/graph/routes";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

const decision = (
  patch: Record<string, unknown>
): PipelineGraphState["decision"] =>
  ({
    intent: "retrieve_and_answer",
    composeMode: "qa",
    searchQuery: "",
    queryType: "default",
    subTasks: [],
    topics: [],
    language: "zh",
    confidence: 0.9,
    clarifyingQuestion: null,
    briefReply: null,
    retrievalPlan: [],
    pathPlan: { steps: [] },
    answerOrder: [],
    userFactKey: null,
    userFactLabel: null,
    userFactValue: null,
    attachmentAction: null,
    routeMode: "respondEarly",
    compositeSlots: [],
    routeReason: null,
    routePlanSource: null,
    ...patch,
  }) as PipelineGraphState["decision"];

const state = (
  patch: Partial<PipelineGraphState>
): PipelineGraphState =>
  ({
    answer: "终稿正文",
    error: null,
    decision: decision({}),
    ...patch,
  }) as PipelineGraphState;

describe("sanitizeVaultSaveBasename", () => {
  it("strips txt, slashes, and illegal chars", () => {
    expect(sanitizeVaultSaveBasename("  notes/a.txt  ")).toBe("notesa");
    expect(sanitizeVaultSaveBasename("foo.TXT")).toBe("foo");
    expect(sanitizeVaultSaveBasename("a..b")).toBe("a.b");
    expect(sanitizeVaultSaveBasename("")).toBeNull();
    expect(sanitizeVaultSaveBasename("...")).toBeNull();
    expect(sanitizeVaultSaveBasename("../x")).toBe("x");
  });
});

describe("parseVaultSaveResume", () => {
  it("parses cancel / confirm / empty name", () => {
    expect(
      parseVaultSaveResume({
        kind: "vault_action",
        prompt: VAULT_SAVE_CANCEL_PROMPT,
      })
    ).toEqual({ kind: "cancel" });
    expect(
      parseVaultSaveResume({
        kind: "vault_action",
        prompt: VAULT_SAVE_CONFIRM_PROMPT,
        name: "memo.txt",
      })
    ).toEqual({ kind: "confirm", name: "memo" });
    expect(
      parseVaultSaveResume({
        kind: "vault_action",
        prompt: `${VAULT_SAVE_CONFIRM_PROMPT}:hello`,
      })
    ).toEqual({ kind: "confirm", name: "hello" });
    expect(
      parseVaultSaveResume({
        kind: "vault_action",
        prompt: VAULT_SAVE_CONFIRM_PROMPT,
        name: "",
      })
    ).toEqual({ kind: "unknown" });
    expect(parseVaultSaveResume({ kind: "vault_action", prompt: "nope" })).toEqual(
      { kind: "unknown" }
    );
  });
});

describe("shouldOfferVaultSaveGate", () => {
  it("offers on attachment summarize/translate and pasted summarize only", () => {
    expect(
      shouldOfferVaultSaveGate(
        state({
          decision: decision({
            composeMode: "summarize",
            intent: "summarize_content",
            searchQuery: "",
            pathPlan: { steps: [] },
          }),
        })
      )
    ).toBe(true);
    expect(
      shouldOfferVaultSaveGate(
        state({
          decision: decision({ attachmentAction: "translate" }),
        })
      )
    ).toBe(true);
    expect(
      shouldOfferVaultSaveGate(
        state({
          decision: decision({ attachmentAction: "summarize" }),
        })
      )
    ).toBe(true);
    expect(
      shouldOfferVaultSaveGate(
        state({
          decision: decision({
            composeMode: "summarize",
            intent: "summarize_content",
            searchQuery: "城管平台 技术栈",
            pathPlan: {
              steps: [
                {
                  id: "km-0",
                  kind: "km",
                  label: "摘要检索",
                  searchQuery: "城管平台 技术栈",
                  queryType: "tech",
                  topics: [],
                },
              ],
            },
          }),
        })
      )
    ).toBe(false);
    expect(shouldOfferVaultSaveGate(state({}))).toBe(false);
    expect(
      shouldOfferVaultSaveGate(
        state({
          decision: decision({ attachmentAction: "extract" }),
        })
      )
    ).toBe(false);
    expect(shouldOfferVaultSaveGate(state({ error: "fail" }))).toBe(false);
    expect(shouldOfferVaultSaveGate(state({ answer: "   " }))).toBe(false);
  });
});

describe("buildVaultSaveGateBlocks", () => {
  it("emits confirm+cancel exact-match prompts", () => {
    const built = buildVaultSaveGateBlocks({ draft: "hello draft" });
    expect(built.answer).toContain("hello draft");
    const actions = built.blocks.find((b) => b.type === "actions");
    expect(actions?.type).toBe("actions");
    if (actions?.type !== "actions") return;
    expect(actions.actions.map((a) => a.prompt)).toEqual([
      VAULT_SAVE_CONFIRM_PROMPT,
      VAULT_SAVE_CANCEL_PROMPT,
    ]);
    expect(actions.actions[0]?.clientHandler).toBe("vault_save_name");
  });
});

describe("save-gate routes", () => {
  it("routes summarizer/analyst to vaultSaveGate when offering", () => {
    const pasted = state({
      decision: decision({
        composeMode: "summarize",
        intent: "summarize_content",
        searchQuery: "",
        pathPlan: { steps: [] },
      }),
    });
    const corpusSummarize = state({
      exitEarly: true,
      decision: decision({
        composeMode: "summarize",
        intent: "summarize_content",
        searchQuery: "城管平台",
      }),
    });
    expect(routeAfterContentSummarizer(pasted)).toBe("vaultSaveGate");
    expect(routeAfterAnalyst(pasted)).toBe("vaultSaveGate");
    expect(routeAfterContentSummarizer(corpusSummarize)).toBe("respondEarly");
    expect(routeAfterAnalyst(corpusSummarize)).toBe("persistTurnEnd");
    expect(routeAfterAnalyst(state({}))).toBe("persistTurnEnd");
  });
});

describe("intake ingest legalize", () => {
  it("coerces attachmentAction ingest to summarize", () => {
    const parsed = parseIntakeRoutingDecision({
      intent: "direct_answer",
      searchQuery: "",
      subTasks: [],
      topics: ["attachment"],
      language: "zh",
      confidence: 0.9,
      queryType: null,
      clarifyingQuestion: null,
      briefReply: null,
      pathPlan: { steps: [] },
      composeMode: "qa",
      retrievalPlan: [],
      attachmentAction: "ingest",
      coreference: "none",
    });
    expect(parsed?.attachmentAction).toBe("summarize");
  });
});
