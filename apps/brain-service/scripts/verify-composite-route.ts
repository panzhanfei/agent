/**
 * PathPlan legalize + deriveCompositeSlots 冒烟（替代已删的 composite-route-guard）。
 * 运行：pnpm --filter @fambrain/brain-service run verify:composite-route
 */
import assert from "node:assert/strict";
import {
  deriveCompositeSlotsFromPathPlan,
  legalizePathPlan,
  looksLikeMultiPartQuestion,
  splitQuestionUnits,
  stepsOfKind,
} from "../src/agentflow/agents/online/intake-coordinator";

let passed = 0;
const assertSync = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`ok — ${name}`);
  } catch (e) {
    console.error(`FAIL — ${name}`);
    throw e;
  }
};

assertSync("multipart 结构信号", () => {
  const q = "我叫什么？今年多大？列出项目";
  assert.ok(looksLikeMultiPartQuestion(q));
  assert.ok(splitQuestionUnits(q).length >= 2);
});

assertSync("list + external_link → list_corpus + km_retrieve", () => {
  const plan = legalizePathPlan({
    steps: [
      {
        id: "list-projects",
        kind: "list",
        label: "项目",
        searchQuery: "项目经历",
        queryType: "enumeration",
        topics: ["project"],
        enumerationControl: {
          action: "exhaustive",
          listKind: "project",
          excludeHint: null,
        },
      },
      {
        id: "km-links",
        kind: "km",
        label: "开源链接",
        searchQuery: "GitHub",
        queryType: "external_link",
        topics: ["project"],
        toolId: "extract_external_links_from_hits",
        dataSource: "corpus",
      },
    ],
  });
  assert.equal(stepsOfKind(plan, "dag").length, 0);
  const slots = deriveCompositeSlotsFromPathPlan(plan);
  assert.deepEqual(
    slots.map((s) => s.executor),
    ["list_corpus", "km_retrieve"]
  );
});

assertSync("userFactKey 无 identityField → mem_recall", () => {
  const plan = legalizePathPlan({
    steps: [
      {
        id: "km-qq",
        kind: "km",
        label: "QQ号",
        searchQuery: "QQ",
        queryType: "identity",
        topics: ["personal"],
        userFactKey: "qq",
        userFactLabel: "QQ号",
      },
    ],
  });
  assert.equal(plan.steps[0]?.kind, "mem");
  assert.equal(plan.steps[0]?.dataSource, "mem0");
  const slots = deriveCompositeSlotsFromPathPlan(plan);
  assert.equal(slots[0]?.executor, "mem_recall");
});

assertSync("search_web → tool_run", () => {
  const plan = legalizePathPlan({
    steps: [
      {
        id: "t0",
        kind: "km",
        label: "公司",
        searchQuery: "公司概况",
        queryType: "default",
        topics: ["external"],
        toolId: "search_web",
        dataSource: "web",
      },
    ],
  });
  assert.equal(plan.steps[0]?.kind, "tool");
  assert.equal(deriveCompositeSlotsFromPathPlan(plan)[0]?.executor, "tool_run");
});

assertSync("identityField phone 保持 km", () => {
  const plan = legalizePathPlan({
    steps: [
      {
        id: "km-phone",
        kind: "km",
        label: "手机",
        searchQuery: "电话",
        queryType: "identity",
        topics: ["personal"],
        identityField: "phone",
        dataSource: "corpus",
      },
    ],
  });
  assert.equal(plan.steps[0]?.kind, "km");
  assert.equal(plan.steps[0]?.identityField, "phone");
});

assertSync("summarize + user_text → summarize_slot", () => {
  const plan = legalizePathPlan({
    steps: [
      {
        id: "sum-0",
        kind: "summarize",
        label: "总结这段",
        searchQuery: "很长的粘贴正文……",
        queryType: "default",
        topics: [],
        dataSource: "user_text",
      },
    ],
  });
  assert.equal(plan.steps[0]?.kind, "summarize");
  assert.equal(
    deriveCompositeSlotsFromPathPlan(plan)[0]?.executor,
    "summarize_slot"
  );
});

console.log(`\nverify-composite-route: ${passed} passed`);
