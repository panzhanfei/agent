/**
 * KnowledgeManager 检索规则验证（KM-07）：不测全链路 / Qdrant，只测 rank + pathBoost。
 *
 *   pnpm --filter @fambrain/brain-service run verify:km-retrieve
 */
import {
  computeRelevance,
  getPathBoost,
  isExperienceEntryPath,
  mergeChunkBodies,
  mergeCandidatesByPath,
  pickExcerpt,
  pickTableExcerpt,
  rankCandidates,
} from "../src/agentflow/agents/online/knowledge-manager/recall";
import {
  getProfileRecallParams,
  inferQueryProfile,
  recallDocKindsForQuery,
  resolveQueryProfile,
} from "../src/agentflow/agents/online/knowledge-manager/profile";

const stubExcerpt = (body: string) => body.slice(0, 120);

const assert = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}: ${msg}`);
    process.exitCode = 1;
  }
};

const personalPath = "data/doc/users/u/corpus/personal/个人简历.md";
const resumeProjectPath = "data/doc/users/u/corpus/projects/resume.md";

console.log("verify-km-retrieve\n— pathBoost —");

assert("personal/ 加分", () => {
  if (getPathBoost(personalPath) !== 0.25) {
    throw new Error(`expected 0.25, got ${getPathBoost(personalPath)}`);
  }
});

assert("projects/resume.md 减分", () => {
  if (getPathBoost(resumeProjectPath) !== -0.2) {
    throw new Error(`expected -0.2, got ${getPathBoost(resumeProjectPath)}`);
  }
});

assert("relevance 排序不解封顶", () => {
  const r = computeRelevance(0.8, 0.5, 0.25);
  if (r !== 1.55) {
    throw new Error(`排序分应为 1.55，实际 ${r}`);
  }
});

console.log("\n— rank（姓名类：personal 应胜过 projects/resume）—");

assert("同等 token/vector 时 personal Top1", () => {
  const body = "| 姓名 | 潘展飞 |\n\n项目简历模板，含姓名、简历等词。";
  const ranked = rankCandidates(
    [
      {
        path: resumeProjectPath,
        title: "resume",
        body,
        score: 0.5,
      },
      {
        path: personalPath,
        title: "个人简历",
        body,
        score: 0.5,
      },
    ],
    tokenize("我的名字是什么"),
    pickExcerpt,
    "identity"
  );
  const top = ranked[0];
  if (!top?.path.includes("/personal/")) {
    throw new Error(`Top1 应为 personal，实际 ${top?.path}`);
  }
  if (top.pathBoost !== 0.25) {
    throw new Error(`pathBoost 应为 0.25，实际 ${top.pathBoost}`);
  }
  if (!top.excerpt.includes("姓名") || !top.excerpt.includes("潘展飞")) {
    throw new Error(`excerpt 应含姓名表格行，实际 ${top.excerpt}`);
  }
});

assert("token 全未命中时 pathBoost 仍可排前（兜底场景）", () => {
  const ranked = rankCandidates(
    [
      {
        path: resumeProjectPath,
        title: "resume",
        body: "unrelated english only",
        score: 0.3,
      },
      {
        path: personalPath,
        title: "个人简历",
        body: "unrelated english only",
        score: 0.9,
      },
    ],
    [],
    stubExcerpt
  );
  const top = ranked[0];
  if (!top?.path.includes("/personal/")) {
    throw new Error(
      `兜底应优先 personal（pathBoost），实际 ${top?.path} relevance=${top?.relevance}`
    );
  }
});

assert("fusion 同为 1 时 experience pathBoost 胜过 project", () => {
  const ranked = rankCandidates(
    [
      {
        path: "data/doc/u/corpus/projects/西安奥卡云.md",
        title: "project",
        body: "西安奥卡云",
        score: 1,
        fusionScore: 1,
        recallChannel: "hybrid",
      },
      {
        path: "data/doc/u/corpus/experience/2021-西安奥卡云.md",
        title: "experience",
        body: "西安奥卡云",
        score: 1,
        fusionScore: 1,
        recallChannel: "hybrid",
      },
    ],
    tokenize("西安奥卡云"),
    pickExcerpt,
    "default"
  );
  if (!ranked[0]?.path.includes("/experience/")) {
    throw new Error(`Top1 应为 experience，实际 ${ranked[0]?.path}`);
  }
  if (!(ranked[0]!.relevance > ranked[1]!.relevance)) {
    throw new Error("解封顶后 experience 分应高于 project");
  }
});

console.log("\n— queryProfile（无口语推断；信 Intake queryType）—");

assert("inferQueryProfile 恒 default（口语表已删）", () => {
  if (inferQueryProfile("我的名字是什么？", []) !== "default") {
    throw new Error("infer 应恒为 default");
  }
  const { maxHits, vectorTopK } = getProfileRecallParams("identity");
  if (maxHits !== 4 || vectorTopK !== 12) {
    throw new Error(`identity 参数应为 12/4，实际 ${vectorTopK}/${maxHits}`);
  }
});

assert("enumeration 参数仍按显式 profile", () => {
  if (inferQueryProfile("我在哪几家公司上过班？", []) !== "default") {
    throw new Error("infer 应恒为 default");
  }
  const { maxHits, vectorTopK } = getProfileRecallParams("enumeration");
  if (maxHits !== 8 || vectorTopK !== 24) {
    throw new Error(`enumeration 参数应为 24/8，实际 ${vectorTopK}/${maxHits}`);
  }
});

assert("tech：infer 不再猜口语", () => {
  if (inferQueryProfile("城管平台用了什么技术栈？", []) !== "default") {
    throw new Error("infer 应恒为 default");
  }
});

assert("Intake queryType 优先于规则", () => {
  const p = resolveQueryProfile("城管平台技术栈", [], "default");
  if (p !== "default") {
    throw new Error("应使用 Intake 的 default");
  }
});

assert("QU-06：queryType=null 时用 default 不再规则推断", () => {
  const p = resolveQueryProfile("我的名字是什么？", [], null);
  if (p !== "default") {
    throw new Error(`Intake null 应为 default，实际 ${p}`);
  }
});

assert("QU-06：queryType 未传时亦 default（无口语 infer）", () => {
  const p = resolveQueryProfile("我的名字是什么？", []);
  if (p !== "default") {
    throw new Error(`未传 queryType 应为 default，实际 ${p}`);
  }
});

console.log("\n— recallDocKindsForQuery（各 queryType 类型过滤）—");

assert("identity / tech / enumeration / external_link / relations / default 映射", () => {
  const identity = recallDocKindsForQuery("identity", "name");
  if (JSON.stringify(identity) !== JSON.stringify(["identity_card"])) {
    throw new Error(`identity name 应为 identity_card，实际 ${identity}`);
  }
  const tenure = recallDocKindsForQuery("identity", "tenure");
  if (
    JSON.stringify(tenure) !==
    JSON.stringify(["identity_card", "experience"])
  ) {
    throw new Error(`tenure 应含 experience，实际 ${tenure}`);
  }
  const tech = recallDocKindsForQuery("tech");
  if (JSON.stringify(tech) !== JSON.stringify(["project", "experience"])) {
    throw new Error(`tech 映射错误 ${tech}`);
  }
  const enumExp = recallDocKindsForQuery("enumeration", null, "experience");
  if (JSON.stringify(enumExp) !== JSON.stringify(["experience"])) {
    throw new Error(`enumeration experience 映射错误 ${enumExp}`);
  }
  const links = recallDocKindsForQuery("external_link");
  if (
    JSON.stringify(links) !==
    JSON.stringify(["project", "experience", "identity_card"])
  ) {
    throw new Error(`external_link 映射错误 ${links}`);
  }
  const relations = recallDocKindsForQuery("relations");
  if (JSON.stringify(relations) !== JSON.stringify(["relations"])) {
    throw new Error(`relations 应为 ["relations"]，实际 ${relations}`);
  }
  if (recallDocKindsForQuery("default") !== null) {
    throw new Error("default 应不过滤");
  }
  const defaultExp = recallDocKindsForQuery("default", null, null, [
    "aky",
    "experience",
  ]);
  if (JSON.stringify(defaultExp) !== JSON.stringify(["experience"])) {
    throw new Error(`default + topics.experience 应为 experience，实际 ${defaultExp}`);
  }
});

console.log("\n— KM-10 表格 excerpt —");

assert("identity 问法优先摘 | 姓名 | 行", () => {
  const body =
    "# 个人简历\n\n## 技术栈\n\nReact Vue\n\n| 姓名 | 潘展飞 |\n| 电话 | 13800000000 |";
  const ex = pickExcerpt(body, tokenize("我的名字"), "identity");
  if (!ex.includes("姓名") || !ex.includes("潘展飞")) {
    throw new Error(`应摘姓名行，实际 ${ex}`);
  }
  if (ex.includes("React")) {
    throw new Error("不应从标题/技术栈线性截断");
  }
});

assert("pickTableExcerpt 匹配 token 字段", () => {
  const body = "| 公司 | 西安奥卡云 |\n| 姓名 | 潘展飞 |";
  const ex = pickTableExcerpt(body, tokenize("奥卡云"), 120);
  if (!ex?.includes("奥卡云")) {
    throw new Error(`应摘公司行，实际 ${ex}`);
  }
});

console.log("\n— KM-16 chunk merge —");

assert("mergeChunkBodies 拼接多段", () => {
  const merged = mergeChunkBodies(["# 头部", "## 技术栈\n\nVue React"]);
  if (!merged.includes("头部") || !merged.includes("Vue")) {
    throw new Error(`应含两段内容，实际 ${merged}`);
  }
});

assert("mergeCandidatesByPath 同 path 合并", () => {
  const path = "data/doc/u/corpus/projects/城管.md";
  const merged = mergeCandidatesByPath([
    { path, title: "t", body: "# 背景", score: 0.8 },
    { path, title: "t", body: "| 技术 | Vue |", score: 0.3 },
  ]);
  if (merged.length !== 1) throw new Error("应合并为 1 条");
  const ex = pickExcerpt(merged[0]!.body, ["vue"], "tech");
  if (!ex.includes("Vue")) throw new Error(`合并后应能摘到技术栈，实际 ${ex}`);
});

console.log("\n— path helpers —");

assert("isExperienceEntryPath 排除 README", () => {
  if (
    !isExperienceEntryPath("data/doc/u/corpus/experience/2021-西安奥卡云.md")
  ) {
    throw new Error("任职 md 应为 experience entry");
  }
  if (isExperienceEntryPath("data/doc/u/corpus/experience/README.md")) {
    throw new Error("README 不应算 entry");
  }
});

console.log("\n— HY-05 sparse rank —");

assert("sparse-only 候选用 BM25 rawScore 参与 rank", () => {
  const ranked = rankCandidates(
    [
      {
        path: "data/doc/u/corpus/personal/个人简历.md",
        title: "简历",
        body: "姓名 潘展飞",
        rawScore: 12,
        recallChannel: "sparse",
      },
      {
        path: "data/doc/u/corpus/projects/noise.md",
        title: "noise",
        body: "无关",
        rawScore: 0.1,
        recallChannel: "sparse",
      },
    ],
    tokenize("姓名 潘展飞"),
    pickExcerpt,
    "identity"
  );
  if (!ranked[0]?.path.includes("personal")) {
    throw new Error(`sparse Top1 应为 personal，实际 ${ranked[0]?.path}`);
  }
  if (ranked[0]!.vectorRelevance <= 0) {
    throw new Error("sparse vectorRelevance 应 > 0");
  }
});

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .filter((t) => t.length >= 2);
}

if (process.exitCode) {
  console.log("\nFAILED");
  process.exit(process.exitCode);
}
console.log("\nOK");
