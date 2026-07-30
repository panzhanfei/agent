/**
 * 列举分页：UI exact-match、按槽 list_corpus、list API、槽答案 blocks cache。
 *
 *   pnpm --filter @fambrain/brain-service run verify:enumeration-pagination
 */
import assert from "node:assert/strict";
import {
    applyEnumerationSlotGuard,
    buildEnumerationListDecision,
    matchUiEnumerationPrompt,
    runIntakePipeline,
} from "../src/agentflow/agents/online/intake-coordinator";
import {
    analystResultToCachedFacet,
    cachedFacetToAnalystResult,
} from "../src/agentflow/cache";
import { composeEnumerationAnswer } from "../src/agentflow/agents/online/information-analyst/compose-message";
import { listCorpusEntriesPage } from "../src/agentflow/agents/online/corpus-lister";
import { retrieveEnumerationPage } from "../src/agentflow/agents/online/corpus-lister";
import { resolveEnumerationPagination } from "../src/agentflow/agents/online/corpus-lister/enumeration";
import { ENUMERATION_EXHAUSTIVE_PAGE_SIZE } from "../src/agentflow/agents/online/corpus-lister";

console.log("verify-enumeration-pagination");

// UI exact-match only（无口语 regex）
assert.equal(matchUiEnumerationPrompt("列出全部项目名称")?.action, "exhaustive");
assert.equal(matchUiEnumerationPrompt("做过哪些项目"), null);
assert.equal(matchUiEnumerationPrompt("列出全部36个项目"), null);
assert.equal(matchUiEnumerationPrompt("更多项目")?.listKind, "project");
assert.equal(matchUiEnumerationPrompt("更多经历")?.listKind, "experience");
assert.equal(matchUiEnumerationPrompt("更多项目")?.action, "continue");

const exhaustiveDecision = buildEnumerationListDecision({
    userQuestion: "列出全部项目名称",
    listKind: "project",
    listIntent: "exhaustive",
    page: 1,
    pageSize: 20,
});
assert.equal(exhaustiveDecision.listIntent, "exhaustive");
assert.equal(exhaustiveDecision.routeMode, "listRetriever");
assert.equal(exhaustiveDecision.compositeSlots[0]?.executor, "list_corpus");
assert.equal(exhaustiveDecision.enumerationPageSize, 20);

const guarded = applyEnumerationSlotGuard(
    {
        ...exhaustiveDecision,
        listIntent: null,
        routeMode: "planFanOut",
        compositeSlots: [
            {
                id: "projects",
                label: "项目经历",
                searchQuery: "项目",
                queryType: "enumeration",
                topics: ["project"],
                subTasks: [],
                enumerationControl: {
                    action: "exhaustive",
                    listKind: "project",
                },
            },
        ],
        searchQuery: "项目",
        queryType: "enumeration",
    },
    "任意问法",
    []
);
assert.equal(guarded.listIntent, "exhaustive");
assert.equal(guarded.routeMode, "listRetriever");
assert.equal(guarded.compositeSlots[0]?.executor, "list_corpus");

// 混合问：tech + list 槽
const mixedRaw = JSON.stringify({
    intent: "retrieve_and_answer",
    searchQuery: "城管 技术栈 项目",
    subTasks: ["城管技术", "全部项目"],
    topics: ["project", "tech-stack"],
    language: "zh",
    confidence: 0.9,
    queryType: "tech",
    clarifyingQuestion: null,
    briefReply: null,
    pathPlan: {
        steps: [
            {
                id: "km-tech",
                kind: "km",
                label: "城管平台技术栈",
                searchQuery: "城市管理平台 技术栈",
                queryType: "tech",
                topics: ["project", "tech-stack"],
                identityField: null,
                toolId: null,
                dataSource: "corpus",
            },
            {
                id: "list-projects",
                kind: "list",
                label: "其它项目全部列出",
                searchQuery: "项目经历 全部项目",
                queryType: "enumeration",
                topics: ["project"],
                enumerationControl: {
                    action: "exhaustive",
                    listKind: "project",
                    excludeHint: "城管",
                    timeWindowYears: null,
                },
            },
        ],
    },
    answerOrder: ["km-tech", "list-projects"],
    composeMode: "composite",
    retrievalPlan: [],
    userFactKey: null,
    userFactLabel: null,
    userFactValue: null,
});
const { decision: mixed } = await runIntakePipeline({
    intakeRaw: mixedRaw,
    userQuestion:
        "城管平台用了那些技术？他除了城管还做了其他那些项目全部列出。",
    intakeHistory: [],
});
assert.equal(mixed.routeMode, "planFanOut");
assert.ok(mixed.compositeSlots.length >= 2, "mixed ≥2 slots");
const execs = mixed.compositeSlots.map((s) => s.executor ?? "km_retrieve");
assert.ok(execs.includes("km_retrieve"), "tech slot km");
assert.ok(execs.includes("list_corpus"), "list slot list_corpus");

const composed = composeEnumerationAnswer({
    hits: Array.from({ length: 20 }, (_, i) => ({
        path: `data/doc/users/u/corpus/projects/p-${i}.md`,
        title: `p-${i}`,
        excerpt: `summary ${i}`,
        relevance: 0.5,
    })),
    language: "zh",
    topics: ["project"],
    enumerationMeta: {
        listKind: "project",
        totalExpected: 36,
        shown: 20,
        page: 1,
        pageSize: 20,
        hasMore: true,
    },
    listIntent: "exhaustive",
});
const enumBlock = composed.blocks!.find((b) => b.type === "enumeration");
assert.ok(enumBlock && enumBlock.type === "enumeration");
assert.equal(enumBlock.page, 1);
assert.equal(enumBlock.pageSize, 20);
assert.equal(enumBlock.hasMore, true);
const actionBlock = composed.blocks!.find((b) => b.type === "actions");
assert.ok(actionBlock && actionBlock.type === "actions");
assert.equal(actionBlock.actions[0]?.prompt, "更多项目");

const cached = analystResultToCachedFacet(
    "facet:projects",
    "项目经历",
    composed,
    "partial"
);
assert.ok(cached.blocks?.length, "槽答案缓存 stores blocks");
const restored = cachedFacetToAnalystResult(cached);
assert.equal(restored.blocks?.length, composed.blocks?.length);

const continueHistory = [
    { role: "user" as const, content: "查看所有项目" },
    {
        role: "assistant" as const,
        content: "preview",
        blocks: [
            {
                type: "enumeration" as const,
                listKind: "project" as const,
                items: [],
                total: 36,
                shown: 8,
                page: 1,
                pageSize: 8,
                hasMore: true,
                startIndex: 1,
            },
        ],
    },
    { role: "user" as const, content: "更多项目" },
];
const continueUi = matchUiEnumerationPrompt("更多项目");
assert.ok(continueUi && continueUi.action === "continue");
const continuePage = resolveEnumerationPagination(continueUi, continueHistory);
const continued = buildEnumerationListDecision({
    userQuestion: "更多项目",
    listKind: continueUi!.listKind,
    listIntent: "continue",
    page: continuePage.page,
    pageSize: continuePage.pageSize,
});
assert.equal(continued.listIntent, "continue");
assert.equal(continued.enumerationPage, 2);
assert.equal(continued.routeMode, "listRetriever");
assert.equal(continued.compositeSlots[0]?.executor, "list_corpus");

const corpusUserId = process.env.FAMBRAIN_CORPUS_USER_ID?.trim();
if (corpusUserId) {
    const page1 = await listCorpusEntriesPage({
        corpusUserId,
        listKind: "project",
        page: 1,
        pageSize: 20,
    });
    assert.ok(page1.total >= 0);
    if (page1.total > 20) {
        assert.equal(page1.hasMore, true);
        const page2 = await retrieveEnumerationPage({
            corpusUserId,
            listKind: "project",
            page: 2,
            pageSize: 20,
        });
        assert.ok(
            page2.enumerationMeta?.hasMore === false || page2.hits.length > 0
        );
    }
    console.log(`live corpus projects total=${page1.total}`);
} else {
    console.log("skip live corpus (set FAMBRAIN_CORPUS_USER_ID for e2e)");
}

console.log("OK");
