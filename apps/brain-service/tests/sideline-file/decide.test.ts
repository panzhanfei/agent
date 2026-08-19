import { describe, expect, it } from "vitest";
import { shouldRunFileAgent } from "@/agentflow/agents/sideline/file";
import type { FileAgentEnvelope } from "@/agentflow/agents/sideline/file";

const envelope = (
  patch: Partial<FileAgentEnvelope>
): FileAgentEnvelope => ({
  task: "save_offer",
  draft: "终稿",
  attachmentAction: null,
  composeMode: "qa",
  intent: "retrieve_and_answer",
  hasPathSteps: false,
  hasSearchQuery: false,
  language: "zh",
  ...patch,
});

describe("shouldRunFileAgent", () => {
  it("always runs workspace tasks", () => {
    expect(
      shouldRunFileAgent(
        envelope({
          task: "workspace",
          draft: "",
          workspaceOp: { operation: "list", targetPath: "" },
        })
      )
    ).toBe(true);
  });

  it("runs save_offer only for new-material summarize/translate", () => {
    expect(
      shouldRunFileAgent(
        envelope({ attachmentAction: "summarize" })
      )
    ).toBe(true);
    expect(
      shouldRunFileAgent(
        envelope({ attachmentAction: "translate" })
      )
    ).toBe(true);
    expect(
      shouldRunFileAgent(
        envelope({
          composeMode: "summarize",
          intent: "summarize_content",
        })
      )
    ).toBe(true);
    expect(
      shouldRunFileAgent(
        envelope({
          composeMode: "summarize",
          intent: "summarize_content",
          hasSearchQuery: true,
        })
      )
    ).toBe(false);
    expect(
      shouldRunFileAgent(
        envelope({
          composeMode: "summarize",
          intent: "summarize_content",
          hasPathSteps: true,
        })
      )
    ).toBe(false);
    expect(shouldRunFileAgent(envelope({}))).toBe(false);
    expect(shouldRunFileAgent(envelope({ draft: "  " }))).toBe(false);
    expect(
      shouldRunFileAgent(envelope({ attachmentAction: "extract" }))
    ).toBe(false);
  });
});
