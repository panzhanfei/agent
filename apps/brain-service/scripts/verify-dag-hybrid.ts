/**
 * 混合 DAG：executionPlan 拓扑 + 匹配结构化 synthesize_merge（L1～L5）。
 *
 *   pnpm --filter @fambrain/brain-service run verify:dag-hybrid
 */
import assert from "node:assert/strict";
import { buildHybridExecutionPlan } from "../src/agentflow/agents/online/dag-executor";
import {
    assertMatchReportAnswer,
    invokeSynthesizeMerge,
    MATCH_REPORT_HEADINGS,
    type ToolRunResult,
} from "../src/agentflow/agents/online/tool-orchestrator";
import {
    type RoutedIntakeDecision,
} from "../src/agentflow/agents/online/intake-coordinator";

process.env.SYNTHESIZE_MATCH_LLM = "0";

const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const decision = (): RoutedIntakeDecision => ({
    intent: "retrieve_and_answer",
    language: "zh",
    subTasks: ["综合评估"],
    topics: ["personal"],
    confidence: 0.9,
    clarifyingQuestion: null,
    briefReply: null,
    searchQuery: "奥卡云 机会 评估",
    queryType: "default",
    retrievalPlan: [],
    routeMode: "planFanOut",
    compositeSlots: [],
    pathPlan: {
        steps: [
            {
                id: "dag-hybrid",
                kind: "dag",
                label: "综合评估",
                searchQuery: "综合评估",
                queryType: "default",
                topics: [],
                template: "hybrid_multi_source",
            },
        ],
    },
    answerOrder: [],
    composeMode: "qa",
    routeReason: "intake_retrieval_plan",
    routePlanSource: "intake_retrieval_plan",
    userFactKey: null,
    userFactLabel: null,
    userFactValue: null,
});

const main = async () => {
    console.log("verify-dag-hybrid\n— buildHybridExecutionPlan —");

    {
        const plan = buildHybridExecutionPlan(
            "根据我的简历和今年市场行情，评估我去奥卡云公司的机会",
            decision()
        );
        assert.equal(plan.length, 4);
        const ids = plan.map((n) => n.id);
        assert.deepEqual(ids, ["resume", "company", "market", "synthesis"]);
        const wave0 = plan.filter((n) => n.deps.length === 0);
        assert.equal(wave0.length, 3);
        const synth = plan.find((n) => n.id === "synthesis")!;
        assert.deepEqual(synth.deps.sort(), ["company", "market", "resume"]);
        ok("混合计划含语料+双联网+汇合");
    }

    console.log("\n— invokeSynthesizeMerge（MatchReport L1～L3）—");

    {
        const resume: ToolRunResult = {
            toolId: "retrieve_corpus",
            label: "个人简历",
            ok: true,
            answer: "前端工程师，React/TS 经验\n全栈开发",
            citations: [{ path: "personal/简历.md", excerpt: "前端" }],
            hits: [],
            insufficientEvidence: false,
            confidence: 0.8,
        };
        const company: ToolRunResult = {
            toolId: "search_web",
            label: "目标公司",
            ok: true,
            answer: "1. 奥卡云：云计算公司\n2. 招聘前端",
            citations: [{ path: "https://example.com", excerpt: "云计算" }],
            hits: [],
            insufficientEvidence: false,
            confidence: 0.7,
        };
        const merged = await invokeSynthesizeMerge({
            label: "综合评估",
            deps: [resume, company],
        });
        assert.ok(merged.matchReport, "须带 matchReport");
        assert.equal(merged.matchReport!.conclusion, "谨慎");
        for (const h of Object.values(MATCH_REPORT_HEADINGS)) {
            assert.ok(merged.answer.includes(h), `answer 须含 ${h}`);
        }
        const structIssues = assertMatchReportAnswer(merged.answer);
        assert.equal(structIssues.length, 0, structIssues.join("; "));
        assert.ok(merged.blocks?.length, "须有 blocks 供 Analyst 渲染");
        ok(`匹配结构化: conclusion=${merged.matchReport!.conclusion}`);
    }

    console.log("\n— 材料不足 → 信息不足 —");

    {
        const resumeOnly: ToolRunResult = {
            toolId: "retrieve_corpus",
            label: "个人简历",
            ok: true,
            answer: "前端工程师",
            citations: [],
            hits: [],
            insufficientEvidence: false,
            confidence: 0.8,
        };
        const merged = await invokeSynthesizeMerge({
            label: "综合评估",
            deps: [resumeOnly],
        });
        assert.equal(merged.matchReport?.conclusion, "信息不足");
        assert.equal(merged.matchReport?.evidenceGrade, "insufficient");
        ok("缺外网 → 信息不足");
    }

    console.log("\nOK");
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
