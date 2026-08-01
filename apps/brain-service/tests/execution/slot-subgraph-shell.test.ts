import { describe, expect, it } from "vitest";
import { getCompiledKmSlotGraph } from "@/agentflow/agents/online/knowledge-manager";
import { getCompiledToolSlotGraph } from "@/agentflow/agents/online/tool-orchestrator";
import { getCompiledPipelineGraph } from "@/agentflow/pipeline/graph/compile";

describe("slot subgraph shell (phase 3)", () => {
  it("compiles km-slot and tool-slot subgraphs", () => {
    const km = getCompiledKmSlotGraph();
    const tool = getCompiledToolSlotGraph();
    expect(km).toBeTruthy();
    expect(tool).toBeTruthy();
    expect(typeof km.invoke).toBe("function");
    expect(typeof tool.invoke).toBe("function");
  });

  it("parent pipeline compiles with subgraph nodes", () => {
    const parent = getCompiledPipelineGraph();
    expect(parent).toBeTruthy();
    expect(typeof parent.stream).toBe("function");
  });
});
