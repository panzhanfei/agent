/**
 * P0-15 / R6-3：Intake retrievalPlan 主路由 + 结构兜底 + merge 单测。
 *
 *   pnpm --filter @fambrain/brain-service run verify:composite-route
 */
import {
  applyCompositeRouteGuard,
  applyIntakeRetrievalPlanGuard,
  canonicalizePlanItem,
  EMPLOYERS_SLOT,
  isCompositeProfileQuestion,
  looksLikeMultiPartQuestion,
  resolveCompositeRoute,
  splitQuestionUnits,
  type IntakeRoutingDecision,
} from "../src/agentflow/agents/online/intake-coordinator/index";
import {
  mergeCompositeHits,
  mergeCompositeRetrieval,
} from "../src/agentflow/agents/online/knowledge-manager/composite/merge";
import { mergeSubQuestionAnswers } from "../src/agentflow/agents/online/information-analyst/analyze-helpers";

const retrieveStub: IntakeRoutingDecision = {
  intent: "retrieve_and_answer",
  searchQuery: "用户原问",
  subTasks: [],
  topics: [],
  language: "zh",
  confidence: 0.8,
  queryType: "identity",
  clarifyingQuestion: null,
  briefReply: null,
  retrievalPlan: [],
};

const assertSync = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}: ${msg}`);
    process.exitCode = 1;
  }
};

console.log("verify-composite-route\n— Intake retrievalPlan —");

assertSync("retrievalPlan ≥2 → slots×2", () => {
  const decision: IntakeRoutingDecision = {
    ...retrieveStub,
    retrievalPlan: [
      {
        label: "姓名",
        searchQuery: "个人简介 简历 姓名",
        queryType: "identity",
        topics: ["personal", "resume"],
      },
      {
        label: "项目经历",
        searchQuery: "项目经历 全部项目",
        queryType: "enumeration",
        topics: ["project"],
      },
    ],
    subTasks: ["姓名", "项目经历"],
  };
  const out = applyCompositeRouteGuard(decision, "综合问");
  if (out.routeMode !== "planFanOut" || out.compositeSlots.length !== 2) {
    throw new Error(`期望 slots×2，实际 ${out.routeMode}/${out.compositeSlots.length}`);
  }
  if (out.routeReason !== "intake_retrieval_plan") {
    throw new Error(`routeReason=${out.routeReason}`);
  }
});

assertSync("P0-15 五连问（有 plan）→ Intake retrievalPlan slots", () => {
  const q =
    "我叫什么？ 今年多大？ 做过那些项目？ 从事什么行业？什么学历？";
  if (!looksLikeMultiPartQuestion(q)) {
    throw new Error("应识别多问结构");
  }
  const units = splitQuestionUnits(q);
  if (units.length < 5) {
    throw new Error(`分句不足: ${units.length} ${units.join("|")}`);
  }
  const out = applyCompositeRouteGuard(
    {
      ...retrieveStub,
      retrievalPlan: [
        {
          label: "姓名",
          searchQuery: "个人简介 简历 姓名 全名",
          queryType: "identity",
          topics: ["personal", "resume"],
          identityField: "name",
        },
        {
          label: "年龄",
          searchQuery: "个人简介 简历 年龄 出生年份",
          queryType: "identity",
          topics: ["personal", "resume"],
          identityField: "age",
        },
        {
          label: "项目经历",
          searchQuery: "项目经历 全部项目 项目名称 职责",
          queryType: "enumeration",
          topics: ["project"],
          enumerationControl: {
            action: "preview",
            listKind: "project",
            excludeHint: null,
          },
        },
        {
          label: "从事行业",
          searchQuery: "个人简介 简历 行业 职业 领域",
          queryType: "identity",
          topics: ["personal", "resume"],
          identityField: "career",
        },
        {
          label: "学历",
          searchQuery: "个人简介 简历 学历 毕业院校",
          queryType: "identity",
          topics: ["personal", "resume"],
          identityField: "education",
        },
      ],
      subTasks: ["姓名", "年龄", "项目经历", "从事行业", "学历"],
    },
    q
  );
  if (out.routeMode !== "planFanOut" || out.compositeSlots.length < 5) {
    throw new Error(
      `期望 slots≥5槽，实际 ${out.routeMode}/${out.compositeSlots.length}`
    );
  }
  if (out.routeReason !== "intake_retrieval_plan") {
    throw new Error(`routeReason=${out.routeReason}`);
  }
  const projectsSlot = out.compositeSlots.find((s) =>
    s.label.includes("项目")
  );
  if (!projectsSlot || projectsSlot.queryType !== "enumeration") {
    throw new Error("项目子问应为 enumeration 检索");
  }
  if (projectsSlot.topics[0] !== "project") {
    throw new Error(`项目槽 topics 应为 project，实际 ${projectsSlot.topics.join(",")}`);
  }
});

assertSync("plan topics/listKind=project → 保留 LLM searchQuery + topics", () => {
  const item = canonicalizePlanItem({
    label: "具体项目名称",
    searchQuery: "用户口语",
    queryType: "enumeration",
    topics: ["project"],
    enumerationControl: {
      action: "preview",
      listKind: "project",
      excludeHint: null,
    },
  });
  if (item.searchQuery !== "用户口语") {
    throw new Error(`应保留 LLM searchQuery，实际 ${item.searchQuery}`);
  }
  if (!item.topics.includes("project")) {
    throw new Error(`topics 应含 project，实际 ${item.topics.join(",")}`);
  }
  if (item.queryType !== "enumeration") {
    throw new Error(`queryType 应为 enumeration，实际 ${item.queryType}`);
  }
});

assertSync(
  "external_link「开源项目的 GitHub 与线上地址」→ 保留 LLM queryType/searchQuery",
  () => {
    const item = canonicalizePlanItem({
      label: "开源项目的 GitHub 与线上地址",
      searchQuery: "开源 GitHub 线上地址",
      queryType: "external_link",
      topics: ["project"],
    });
    if (item.queryType !== "external_link") {
      throw new Error(`queryType 应为 external_link，实际 ${item.queryType}`);
    }
    if (!item.searchQuery.includes("开源")) {
      throw new Error(`searchQuery 应保留 LLM 语义: ${item.searchQuery}`);
    }
    // 空 topics 才补模板；已有 topics 则保留
    if (!item.topics.includes("project")) {
      throw new Error(`topics 应保留 project: ${item.topics.join(",")}`);
    }
  }
);

assertSync("空 retrievalPlan → clarify/skip（档 B 不发明槽）", () => {
  const out = applyCompositeRouteGuard(
    { ...retrieveStub, queryType: "enumeration", topics: ["experience"] },
    "我在哪几家公司上过班？"
  );
  if (out.routeMode !== "respondEarly" || out.intent !== "clarify") {
    throw new Error(
      `期望 respondEarly+clarify，实际 ${out.routeMode}/${out.intent}`
    );
  }
});

assertSync("有 retrievalPlan 列举 → plan×1 employers 语义", () => {
  const out = applyCompositeRouteGuard(
    {
      ...retrieveStub,
      queryType: "enumeration",
      topics: ["experience"],
      searchQuery: "供职单位 工作经历",
      retrievalPlan: [
        {
          label: "供职单位",
          searchQuery: EMPLOYERS_SLOT.searchQuery,
          queryType: "enumeration",
          topics: ["experience"],
          enumerationControl: {
            action: "preview",
            listKind: "experience",
            excludeHint: null,
          },
        },
      ],
    },
    "供职过哪些单位？"
  );
  if (
    out.routeMode !== "planFanOut" ||
    out.compositeSlots.length !== 1 ||
    out.compositeSlots[0]?.queryType !== "enumeration"
  ) {
    throw new Error(
      `期望 plan×1 enumeration，实际 ${out.routeMode}/${out.compositeSlots[0]?.queryType}`
    );
  }
});

assertSync("有 retrievalPlan tech → plan×1", () => {
  const out = applyCompositeRouteGuard(
    {
      ...retrieveStub,
      queryType: "tech",
      searchQuery: "城管平台 技术栈",
      retrievalPlan: [
        {
          label: "城管平台技术栈",
          searchQuery: "城管平台 技术栈",
          queryType: "tech",
          topics: ["project", "tech-stack"],
        },
      ],
    },
    "城管平台用了什么技术"
  );
  if (out.routeMode !== "planFanOut" || out.compositeSlots.length !== 1) {
    throw new Error(`实际 ${out.routeMode}/${out.compositeSlots.length}`);
  }
});

assertSync("闲聊 → skip", () => {
  const out = applyCompositeRouteGuard(
    {
      ...retrieveStub,
      intent: "chitchat",
      briefReply: "你好",
    },
    "你好"
  );
  if (out.routeMode !== "respondEarly") throw new Error("chitchat 应为 respondEarly");
});

assertSync("有 retrievalPlan 年龄 → plan×1 identity", () => {
  const q = "我今年多大";
  const out = applyCompositeRouteGuard(
    {
      ...retrieveStub,
      queryType: "identity",
      searchQuery: "个人简介 简历 年龄 出生年份",
      subTasks: [],
      retrievalPlan: [
        {
          label: "年龄",
          searchQuery: "个人简介 简历 年龄 出生年份",
          queryType: "identity",
          topics: ["personal", "resume"],
          identityField: "age",
        },
      ],
    },
    q
  );
  if (out.routeMode !== "planFanOut" || out.compositeSlots.length !== 1) {
    throw new Error(`期望 plan×1，实际 ${out.routeMode}/${out.compositeSlots.length}`);
  }
  if (!out.searchQuery.includes("个人简介") || !out.searchQuery.includes("年龄")) {
    throw new Error(`searchQuery 异常: ${out.searchQuery}`);
  }
  if (out.compositeSlots[0]?.queryType !== "identity") {
    throw new Error(`queryType=${out.compositeSlots[0]?.queryType}`);
  }
});

assertSync("有 retrievalPlan 年龄口语 → plan×1 identity", () => {
  const q = "年龄多大";
  const out = applyCompositeRouteGuard(
    {
      ...retrieveStub,
      queryType: "identity",
      searchQuery: "个人简介 简历 年龄",
      topics: ["personal", "resume"],
      retrievalPlan: [
        {
          label: "年龄",
          searchQuery: "个人简介 简历 年龄",
          queryType: "identity",
          topics: ["personal", "resume"],
          identityField: "age",
        },
      ],
    },
    q
  );
  if (
    out.routeMode !== "planFanOut" ||
    out.compositeSlots.length !== 1 ||
    out.compositeSlots[0]?.queryType !== "identity"
  ) {
    throw new Error(`identity 不符: ${out.routeMode}`);
  }
});

console.log("\n— 结构 / subTasks（档 B：不发明多槽）—");

assertSync("空 plan + subTasks≥2 → skip/clarify（不拆问）", () => {
  const decision: IntakeRoutingDecision = {
    ...retrieveStub,
    queryType: "default",
    searchQuery: "个人简介 项目 工作经历",
    subTasks: ["提取姓名", "列举项目", "哪几家公司", "近两年动态"],
    topics: ["personal", "experience", "project"],
    retrievalPlan: [],
  };
  const out = applyCompositeRouteGuard(decision, "整体介绍一下");
  if (out.routeMode !== "respondEarly" || out.intent !== "clarify") {
    throw new Error(
      `期望 respondEarly+clarify，实际 ${out.routeMode}/${out.intent}/${out.compositeSlots.length}`
    );
  }
});

assertSync("空 plan → resolveCompositeRoute 0 槽", () => {
  const decision: IntakeRoutingDecision = {
    ...retrieveStub,
    queryType: "enumeration",
    searchQuery: "工作经历 公司 列举",
    topics: ["experience"],
    subTasks: ["列出全部公司"],
  };
  const resolved = resolveCompositeRoute(decision, "能说说吗");
  if (resolved.slots.length !== 0 || resolved.source !== "none") {
    throw new Error(
      `期望 0 槽 source=none，实际 ${resolved.slots.length}/${resolved.source}`
    );
  }
});

assertSync("retrievalPlan 5 项 → 非固定 4 槽", () => {
  const q =
    "我叫什么？ 今年多大？ 做过那些项目？ 从事什么行业？什么学历？";
  const plan = [
    {
      label: "姓名",
      searchQuery: "个人简介 简历 姓名",
      queryType: "identity" as const,
      topics: ["personal", "resume"],
      identityField: "name" as const,
    },
    {
      label: "年龄",
      searchQuery: "个人简介 简历 年龄",
      queryType: "identity" as const,
      topics: ["personal", "resume"],
      identityField: "age" as const,
    },
    {
      label: "项目",
      searchQuery: "项目经历",
      queryType: "enumeration" as const,
      topics: ["project"],
      enumerationControl: {
        action: "preview" as const,
        listKind: "project" as const,
        excludeHint: null,
      },
    },
    {
      label: "行业",
      searchQuery: "个人简介 简历 行业",
      queryType: "identity" as const,
      topics: ["personal", "resume"],
      identityField: "career" as const,
    },
    {
      label: "学历",
      searchQuery: "个人简介 简历 学历",
      queryType: "identity" as const,
      topics: ["personal", "resume"],
      identityField: "education" as const,
    },
  ];
  if (
    !isCompositeProfileQuestion(
      { ...retrieveStub, retrievalPlan: plan },
      q
    )
  ) {
    throw new Error("应识别 composite");
  }
});

console.log("\n— Intake retrievalPlan guard —");

assertSync("多问但 plan 空 → 不补槽（档 B）→ clarify", () => {
  const q =
    "我叫什么？ 今年多大？ 做过那些项目？ 从事什么行业？什么学历？";
  const guarded = applyIntakeRetrievalPlanGuard(retrieveStub, q);
  if ((guarded.retrievalPlan?.length ?? 0) !== 0) {
    throw new Error(`不应发明 plan: ${guarded.retrievalPlan?.length}`);
  }
  if (guarded.retrievalPlanGuardReason !== "noop") {
    throw new Error(`reason=${guarded.retrievalPlanGuardReason}`);
  }
  const out = applyCompositeRouteGuard(guarded, q);
  if (out.routeMode !== "respondEarly" || out.intent !== "clarify") {
    throw new Error(
      `期望 respondEarly+clarify，实际 ${out.routeMode}/${out.intent}/${out.compositeSlots.length}`
    );
  }
});

assertSync("plan identity 项 → 保留 LLM searchQuery（不强制模板覆盖）", () => {
  const guarded = applyIntakeRetrievalPlanGuard(
    {
      ...retrieveStub,
      retrievalPlan: [
        {
          label: "姓名",
          searchQuery: "用户口语 姓名 叫什么",
          queryType: "identity",
          topics: ["personal", "resume"],
        },
        {
          label: "学历",
          searchQuery: "啥学历啊",
          queryType: "identity",
          topics: ["personal"],
        },
      ],
    },
    "姓名？学历？"
  );
  const sq = guarded.retrievalPlan[0]?.searchQuery ?? "";
  if (!sq.includes("用户口语") || !sq.includes("姓名")) {
    throw new Error(`应保留 LLM searchQuery: ${sq}`);
  }
});

console.log("\n— merge —");

assertSync("merge hits 按 path 去重", () => {
  const merged = mergeCompositeHits([
    {
      slot: "plan-0",
      label: "x",
      hits: [{ path: "a.md", title: "A", excerpt: "潘展飞", relevance: 0.9 }],
      coverage: "sufficient",
      notes: null,
      cacheHit: false,
    },
    {
      slot: "plan-1",
      label: "y",
      hits: [
        { path: "a.md", title: "A", excerpt: "dup", relevance: 0.5 },
        { path: "b.md", title: "B", excerpt: "奥卡云", relevance: 0.8 },
      ],
      coverage: "partial",
      notes: null,
      cacheHit: false,
    },
  ]);
  if (merged.length !== 2 || merged[0]?.path !== "a.md") {
    throw new Error(`去重失败: ${JSON.stringify(merged)}`);
  }
});

assertSync("merge coverage → partial", () => {
  const r = mergeCompositeRetrieval([
    {
      slot: "plan-0",
      label: "x",
      hits: [{ path: "a", title: "A", excerpt: "x", relevance: 1 }],
      coverage: "sufficient",
      notes: null,
      cacheHit: false,
    },
    {
      slot: "plan-1",
      label: "y",
      hits: [],
      coverage: "none",
      notes: null,
      cacheHit: false,
    },
  ]);
  if (r.coverage !== "partial")
    throw new Error(`期望 partial，实际 ${r.coverage}`);
});

assertSync("mergeSubQuestionAnswers 分段合并", () => {
  const merged = mergeSubQuestionAnswers([
    {
      order: 0,
      label: "姓名",
      result: {
        answer: "潘展飞",
        citations: [],
        confidence: 0.9,
        insufficientEvidence: false,
      },
    },
    {
      order: 1,
      label: "学历",
      result: {
        answer: "专科（统招）",
        citations: [],
        confidence: 0.9,
        insufficientEvidence: false,
      },
    },
  ]);
  if (!merged.answer.includes("1. 姓名") || !merged.answer.includes("2. 学历")) {
    throw new Error(`分段合并失败: ${merged.answer}`);
  }
});

if (process.exitCode) {
  console.log("\nFAILED");
  process.exit(process.exitCode);
}
console.log("\nOK");
