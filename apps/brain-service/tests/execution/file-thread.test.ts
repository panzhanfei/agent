import { afterEach, describe, expect, it } from "vitest";
import {
  discardFileTask,
  discardPipelineTask,
  fileThreadId,
  pipelineThreadId,
  resetPipelineCheckpointForTests,
} from "@/agentflow/execution";

afterEach(() => {
  resetPipelineCheckpointForTests();
});

describe("file thread generation", () => {
  it("is independent of the QA pipeline thread", () => {
    const conv = "conv-file-dual";
    expect(pipelineThreadId(conv)).toBe("fambrain:conv-file-dual:0");
    expect(fileThreadId(conv)).toBe("fambrain-file:conv-file-dual:0");

    discardPipelineTask(conv);
    expect(pipelineThreadId(conv)).toBe("fambrain:conv-file-dual:1");
    expect(fileThreadId(conv)).toBe("fambrain-file:conv-file-dual:0");

    const nextFile = discardFileTask(conv);
    expect(nextFile).toBe("fambrain-file:conv-file-dual:1");
    expect(pipelineThreadId(conv)).toBe("fambrain:conv-file-dual:1");
  });
});
