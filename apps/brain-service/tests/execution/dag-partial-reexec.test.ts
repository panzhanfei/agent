import { describe, expect, it } from "vitest";
import {
  canReuseDagNodeResult,
  collectDownstreamRerunClosure,
} from "@/agentflow/execution";
import type { ExecutionPlanNode } from "@/agentflow/agents/online/tool-orchestrator/interface";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import { expandHybridMultiSourceTemplate } from "@/agentflow/agents/online/intake-coordinator/path-plan";
import { applyGlobalRebatchRepairs } from "@/agentflow/agents/online/plan-fanout/global-rebatch";
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator/guards/interface";

const ok = (id: string): ToolRunResult => ({
  toolId: "search_web",
  label: id,
  ok: true,
  answer: "ok",
  citations: [],
  hits: [{ path: `${id}.md`, title: id, excerpt: id, relevance: 0.9 }],
  insufficientEvidence: false,
  confidence: 0.9,
});

const fail = (id: string): ToolRunResult => ({
  toolId: "search_web",
  label: id,
  ok: false,
  answer: "fail",
  citations: [],
  hits: [],
  insufficientEvidence: true,
  confidence: 0.1,
});

describe("collectDownstreamRerunClosure", () => {
  const plan = expandHybridMultiSourceTemplate("适合某公司吗", "简历 公司");

  it("forces company and downstream synthesis", () => {
    const rerun = collectDownstreamRerunClosure(plan, ["company"]);
    expect([...rerun].sort()).toEqual(["company", "synthesis"].sort());
    expect(rerun.has("resume")).toBe(false);
    expect(rerun.has("market")).toBe(false);
  });

  it("forces resume and synthesis (hard dep chain)", () => {
    const rerun = collectDownstreamRerunClosure(plan, ["resume"]);
    expect(rerun.has("resume")).toBe(true);
    expect(rerun.has("synthesis")).toBe(true);
  });
});

describe("canReuseDagNodeResult", () => {
  it("reuses ok results only", () => {
    expect(canReuseDagNodeResult(ok("a"))).toBe(true);
    expect(canReuseDagNodeResult(fail("a"))).toBe(false);
    expect(
      canReuseDagNodeResult({
        ...fail("a"),
        skipped: true,
        skipReason: "deps",
      })
    ).toBe(false);
  });
});

describe("hybrid template emptyPolicy defaults", () => {
  it("marks resume require and web omit", () => {
    const plan = expandHybridMultiSourceTemplate("q", "q");
    expect(plan.find((n) => n.id === "resume")?.emptyPolicy).toBe("require");
    expect(plan.find((n) => n.id === "company")?.emptyPolicy).toBe("omit");
    expect(plan.find((n) => n.id === "market")?.emptyPolicy).toBe("omit");
    expect(plan.find((n) => n.id === "synthesis")?.emptyPolicy).toBe("degrade");
  });
});

describe("applyGlobalRebatchRepairs dag node ids", () => {
  it("returns rebatchDagNodeIds for patched nodes", () => {
    const plan: ExecutionPlanNode[] = expandHybridMultiSourceTemplate("q", "q");
    const decision = {
      compositeSlots: [],
      executionPlan: plan,
      pathPlan: { steps: [] },
    } as unknown as RoutedIntakeDecision;

    const applied = applyGlobalRebatchRepairs({
      decision,
      repairs: [
        {
          targetId: "company",
          kind: "dag_node",
          action: "rewrite_search_query",
          searchQuery: "新公司查询",
        },
      ],
      allowedSlotIds: new Set(),
      allowedDagNodeIds: new Set(["company"]),
    });

    expect(applied.rebatchDag).toBe(true);
    expect(applied.rebatchDagNodeIds).toEqual(["company"]);
    expect(
      applied.decision.executionPlan?.find((n) => n.id === "company")?.webQuery
    ).toContain("新公司");
  });
});
