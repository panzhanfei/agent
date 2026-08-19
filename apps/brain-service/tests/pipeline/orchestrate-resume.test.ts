import { afterEach, describe, expect, it } from "vitest";
import { orchestrateAgentStream } from "@/agentflow/pipeline";
import {
  resetPipelineCheckpointForTests,
} from "@/agentflow/execution";
import { resetCompiledPipelineGraph } from "@/agentflow/pipeline/graph/compile";
import { resetCompiledFileGraph } from "@/agentflow/agents/sideline/file";

afterEach(() => {
  resetPipelineCheckpointForTests();
  resetCompiledPipelineGraph();
  resetCompiledFileGraph();
});

describe("orchestrateAgentStream resume", () => {
  it("rejects vault Resume without jobId", async () => {
    const gen = orchestrateAgentStream(
      [{ role: "user", content: "确定入库" }],
      {
        actorUserId: "u1",
        corpusUserId: "u1",
        displayName: "test",
        conversationId: "conv-resume-no-job",
        resume: {
          kind: "vault_action",
          jobId: "",
          prompt: "__FAMBRAIN_VAULT_SAVE_CONFIRM__",
        },
      }
    );
    let result: { answer?: string } | undefined;
    while (true) {
      const next = await gen.next();
      if (next.done) {
        result = next.value;
        break;
      }
    }
    expect(result?.answer).toMatch(/缺少 jobId/);
  });
});
