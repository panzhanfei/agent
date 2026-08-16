import { describe, expect, it } from "vitest";
import { getCompiledPipelineGraph } from "@/agentflow/pipeline/graph/compile";

describe("pipeline graph compile", () => {
  it("parent pipeline compiles with flat slot workers", () => {
    const parent = getCompiledPipelineGraph();
    expect(parent).toBeTruthy();
    expect(typeof parent.stream).toBe("function");
  });
});
