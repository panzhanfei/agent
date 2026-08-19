import { describe, expect, it } from "vitest";
import { pipelineStreamBodySchema } from "@/server/schema";

const base = {
  history: [{ role: "user" as const, content: "hi" }],
  context: {
    actorUserId: "u1",
    corpusUserId: "u1",
    displayName: "t",
    conversationId: "c1",
  },
};

describe("pipelineStreamBodySchema resume", () => {
  it("requires jobId on vault_action", () => {
    const missing = pipelineStreamBodySchema.safeParse({
      ...base,
      context: {
        ...base.context,
        resume: { kind: "vault_action", prompt: "x" },
      },
    });
    expect(missing.success).toBe(false);

    const empty = pipelineStreamBodySchema.safeParse({
      ...base,
      context: {
        ...base.context,
        resume: { kind: "vault_action", jobId: "", prompt: "x" },
      },
    });
    expect(empty.success).toBe(false);

    const ok = pipelineStreamBodySchema.safeParse({
      ...base,
      context: {
        ...base.context,
        resume: { kind: "vault_action", jobId: "job-1", prompt: "x" },
      },
    });
    expect(ok.success).toBe(true);
  });
});
