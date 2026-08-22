/**
 * DAG：nodes 合法化 + synthesize_merge（match_report / free）。
 *
 *   pnpm --filter @fambrain/brain-service run verify:dag-hybrid
 */
import assert from "node:assert/strict";
import {
    executionPlanFromPathPlanDag,
    legalizePathPlan,
} from "../src/agentflow/agents/online/intake-coordinator/path-plan";
import {
    assertMatchReportAnswer,
    invokeSynthesizeMerge,
    MATCH_REPORT_HEADINGS,
    type ToolRunResult,
} from "../src/agentflow/agents/online/tool-orchestrator";

process.env.SYNTHESIZE_MATCH_LLM = "0";

const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const main = async () => {
    console.log("verify-dag-hybrid\n— legalize dag.nodes —");

    {
        const empty = legalizePathPlan({
            steps: [
                {
                    id: "dag-old",
                    kind: "dag",
                    label: "评估",
                    searchQuery: "评估",
                    queryType: "default",
                    topics: [],
                    template: "hybrid_multi_source",
                },
            ],
        });
        assert.equal(empty.steps.length, 0);
        ok("无 nodes 的 template dag 丢弃");
    }

    {
        const pathPlan = legalizePathPlan({
            steps: [
                {
                    id: "dag-fit",
                    kind: "dag",
                    label: "面试适合度",
                    searchQuery: "履历评估",
                    queryType: "default",
                    topics: [],
                    nodes: [
                        {
                            id: "resume",
                            label: "简历",
                            toolId: "retrieve_corpus",
                            searchQuery: "个人简介 简历",
                            deps: [],
                        },
                        {
                            id: "company",
                            label: "公司",
                            toolId: "search_web",
                            searchQuery: "奥卡云 公司",
                            deps: [],
                        },
                        {
                            id: "synth",
                            label: "综合",
                            toolId: "synthesize_merge",
                            deps: ["resume", "company"],
                            synthesizeSchema: "match_report",
                        },
                    ],
                },
            ],
        });
        const plan = executionPlanFromPathPlanDag(pathPlan);
        assert.ok(plan);
        assert.deepEqual(plan.map((n) => n.id), ["resume", "company", "synth"]);
        assert.equal(plan[2]?.synthesizeSchema, "match_report");
        ok("nodes → executionPlan");
    }

    console.log("\n— invokeSynthesizeMerge match_report —");

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
            schema: "match_report",
        });
        assert.ok(merged.matchReport, "须带 matchReport");
        assert.equal(merged.matchReport!.conclusion, "谨慎");
        for (const h of Object.values(MATCH_REPORT_HEADINGS)) {
            assert.ok(merged.answer.includes(h), `answer 须含 ${h}`);
        }
        const structIssues = assertMatchReportAnswer(merged.answer);
        assert.equal(structIssues.length, 0, structIssues.join("; "));
        ok(`匹配结构化: conclusion=${merged.matchReport!.conclusion}`);
    }

    console.log("\n— invokeSynthesizeMerge free —");

    {
        const weather: ToolRunResult = {
            toolId: "get_weather",
            label: "天水天气",
            ok: true,
            answer: "天水，中国：28°C，多云。",
            citations: [],
            hits: [],
            insufficientEvidence: false,
            confidence: 0.9,
        };
        const merged = await invokeSynthesizeMerge({
            label: "是否适合出门",
            deps: [weather],
            schema: "free",
        });
        assert.equal(merged.matchReport, undefined);
        assert.match(merged.answer, /28°C/);
        assert.ok(!merged.answer.includes("## 匹配点"));
        ok("free 汇合不走匹配四栏");
    }

    console.log("\nOK");
};

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
