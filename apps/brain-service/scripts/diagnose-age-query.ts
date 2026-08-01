/**
 * 诊断「我今年多大」：pathPlan 合法化 + KM 检索 + 语料字段。
 *
 *   pnpm --filter @fambrain/brain-service exec tsx --env-file=../../.env scripts/diagnose-age-query.ts
 */
import { readFile } from "node:fs/promises";
import { getRetrievalFromCache } from "@fambrain/infra";
import {
  deriveCompositeSlotsFromPathPlan,
  legalizePathPlan,
} from "../src/agentflow/agents/online/intake-coordinator";
import { retrieveKnowledge } from "../src/agentflow/agents/online/knowledge-manager/recall/retrieve";
import { listCorpusUserIds } from "../src/agentflow/agents/offline/knowledge-indexer/list-corpus-users";

const USER_QUESTION = "我今年多大";

const resolveCorpusUserId = async (): Promise<string> => {
  const fromEnv = process.env.FAMBRAIN_CORPUS_USER_ID?.trim();
  if (fromEnv) return fromEnv;
  const ids = await listCorpusUserIds();
  if (ids.length === 0) throw new Error("无 corpus 用户");
  return ids[0]!;
};

const corpusAgeFields = async (corpusUserId: string) => {
  const resumePath = `data/doc/users/${corpusUserId}/corpus/personal/个人简历-潘展飞.md`;
  try {
    const body = await readFile(resumePath, "utf8");
    const ageRe = /年龄|出生|周岁|\d{4}[年./-]\d{1,2}|19\d{2}|20\d{2}年/g;
    const matches = body.match(ageRe) ?? [];
    const tableRows = body
      .split("\n")
      .filter((l) => l.trim().startsWith("|") && /年龄|出生/.test(l));
    return { resumePath, bodyLen: body.length, matches, tableRows };
  } catch (e) {
    return {
      resumePath,
      error: e instanceof Error ? e.message : String(e),
    };
  }
};

const main = async () => {
  const corpusUserId = await resolveCorpusUserId();
  console.log("=== diagnose-age-query ===\n");
  console.log(`corpusUserId: ${corpusUserId}`);
  console.log(`userQuestion: ${USER_QUESTION}\n`);

  console.log("— 1. 语料 personal 简历 —");
  const corpus = await corpusAgeFields(corpusUserId);
  console.log(JSON.stringify(corpus, null, 2));

  console.log("\n— 2. pathPlan legalize（age 步）—");
  const pathPlan = legalizePathPlan({
    steps: [
      {
        id: "km-age",
        kind: "km",
        label: "年龄",
        searchQuery: "个人简介 简历 年龄 出生年份 出生日期",
        queryType: "identity",
        topics: ["personal", "resume"],
        identityField: "age",
        toolId: "compute_age_from_hits",
        dataSource: "compute",
      },
    ],
  });
  const slots = deriveCompositeSlotsFromPathPlan(pathPlan);
  const searchQuery =
    slots[0]?.searchQuery || "个人简介 简历 年龄 出生年份 出生日期";
  const topics = slots[0]?.topics ?? ["personal", "resume"];
  console.log(
    JSON.stringify(
      {
        pathKind: pathPlan.steps[0]?.kind,
        slotLabel: slots[0]?.label,
        identityField: slots[0]?.identityField,
        toolId: slots[0]?.toolId,
        searchQuery,
      },
      null,
      2
    )
  );

  console.log("\n— 3. 检索 hits 缓存 —");
  const cacheKey = {
    corpusUserId,
    searchQuery,
    queryType: "identity" as const,
  };
  const l2 = await getRetrievalFromCache(cacheKey);
  console.log(
    l2
      ? JSON.stringify({
          hitCount: l2.hits.length,
          coverage: l2.coverage,
          topPath: l2.hits[0]?.path,
        })
      : "cache miss"
  );

  console.log("\n— 4. KM 检索 —");
  let retrieval;
  try {
    retrieval = await retrieveKnowledge({
      corpusUserId,
      searchQuery,
      topics,
      subTasks: ["年龄"],
      queryType: "identity",
      candidates: [],
    });
  } catch (e) {
    console.error(
      "retrieveKnowledge 失败:",
      e instanceof Error ? e.message : e
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        searchQuery,
        hitCount: retrieval.hits.length,
        coverage: retrieval.coverage,
        confidenceTier: retrieval.confidenceTier,
        notes: retrieval.notes,
        paths: retrieval.hits.map((h) => h.path),
        excerpts: retrieval.hits.slice(0, 3).map((h) => ({
          path: h.path,
          relevance: h.relevance,
          excerpt: h.excerpt.slice(0, 200),
        })),
      },
      null,
      2
    )
  );

  console.log("\n— 5. 结论 —");
  const hasAgeInExcerpt = retrieval.hits.some((h) =>
    /年龄|出生|周岁|19\d{2}|20\d{2}/.test(h.excerpt)
  );
  const { runOrchestratedSubQuestion } = await import(
    "../src/agentflow/tools/orchestrated"
  );
  const orchestrated = runOrchestratedSubQuestion({
    userQuestion: USER_QUESTION,
    language: "zh",
    hits: retrieval.hits,
    coverage: retrieval.coverage,
    notes: retrieval.notes,
    queryType: "identity",
    identityField: "age",
    asOfDate: new Date().toISOString().slice(0, 10),
  });
  if (orchestrated) {
    console.log(
      JSON.stringify(
        {
          tool: "compute_age_from_hits",
          answer: orchestrated.answer,
          insufficientEvidence: orchestrated.insufficientEvidence,
        },
        null,
        2
      )
    );
  }
  if (retrieval.hits.length === 0) {
    console.log(
      "❌ hitCount=0 → Analyst 走 rules_empty_hits_skip_llm + 年龄兜底文案"
    );
  } else if (!hasAgeInExcerpt) {
    console.log(
      "⚠️  有 hits 但 excerpt 无年龄/出生 → orchestrated 工具 insufficient 兜底"
    );
  } else if (orchestrated && !orchestrated.insufficientEvidence) {
    console.log("✅ orchestrated compute_age_from_hits 已算出周岁（非 LLM 推算）");
  } else {
    console.log("⚠️  excerpt 含日期但未能解析出生 → 检查 excerpt 格式");
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
