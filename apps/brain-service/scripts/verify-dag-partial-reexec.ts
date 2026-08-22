/**
 * DAG 再批：闭包 + seed 复用（结构断言，不调 LLM/外搜）。
 *
 *   pnpm --filter @fambrain/brain-service run verify:dag-partial-reexec
 */
import {
  canReuseDagNodeResult,
  collectDownstreamRerunClosure,
} from "../src/agentflow/execution";
import type { ExecutionPlanNode } from "../src/agentflow/agents/online/tool-orchestrator/interface";
import { applyEmptyPolicies } from "../src/agentflow/agents/online/plan-fanout/empty-policy";

const plan: ExecutionPlanNode[] = [
  {
    id: "resume",
    label: "简历",
    dataSource: "corpus",
    toolId: "retrieve_corpus",
    searchQuery: "简历",
    deps: [],
    emptyPolicy: "require",
  },
  {
    id: "company",
    label: "公司",
    dataSource: "web",
    toolId: "search_web",
    searchQuery: "公司",
    deps: [],
    emptyPolicy: "omit",
  },
  {
    id: "market",
    label: "市场",
    dataSource: "web",
    toolId: "search_web",
    searchQuery: "市场",
    deps: [],
    emptyPolicy: "omit",
  },
  {
    id: "synthesis",
    label: "综合",
    dataSource: "synthesize",
    toolId: "synthesize_merge",
    deps: ["resume", "company", "market"],
    emptyPolicy: "degrade",
    synthesizeSchema: "match_report",
  },
];
const closure = collectDownstreamRerunClosure(plan, ["company"]);
const ok = {
  toolId: "retrieve_corpus" as const,
  label: "简历",
  ok: true,
  answer: "ok",
  citations: [],
  hits: [{ path: "r.md", title: "r", excerpt: "x", relevance: 0.9 }],
  insufficientEvidence: false,
  confidence: 0.9,
};

const issues: string[] = [];
if (!closure.has("company") || !closure.has("synthesis")) {
  issues.push("company 失败闭包应含 company+synthesis");
}
if (closure.has("resume") || closure.has("market")) {
  issues.push("不应重跑未依赖的 resume/market");
}
if (!canReuseDagNodeResult(ok)) {
  issues.push("成功节点应可复用");
}
if (plan.find((n) => n.id === "resume")?.emptyPolicy !== "require") {
  issues.push("resume 默认 emptyPolicy=require");
}

const policy = applyEmptyPolicies({
  pathPlan: {
    steps: [
      {
        id: "km-name",
        kind: "km",
        label: "姓名",
        searchQuery: "姓名",
        queryType: "identity",
        topics: [],
        emptyPolicy: "require",
      },
    ],
  },
  slots: [],
  stepResults: [
    {
      stepId: "km-name",
      pathKind: "km",
      label: "姓名",
      hits: [],
      coverage: "none",
      notes: null,
    },
  ],
  compositeSubResults: null,
});
if (!policy.requireError) {
  issues.push("require 空证据应报错");
}

if (issues.length) {
  console.error("❌", issues.join("; "));
  process.exit(1);
}
console.log("✅ DAG partial reexec + emptyPolicy 结构断言通过", {
  closure: [...closure],
  resumePolicy: plan.find((n) => n.id === "resume")?.emptyPolicy,
});
