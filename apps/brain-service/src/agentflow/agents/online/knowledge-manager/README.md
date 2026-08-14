# KnowledgeManager（语料检索）

KM 是 Pipeline 的**纯规则检索 Agent**（复合路径在 **plan-fanout** 内调用；纯 list 见 [`../corpus-lister/`](../corpus-lister/README.md)）。

**KM 不做的事：** 调 Chat LLM 精排、写最终长答、读写 Mem0、Intake 路由决策（见 [`../intake-coordinator/`](../intake-coordinator/README.md)）。

---

## 1. 设计思路

### 1.1 为什么单独做一个 Agent？

| 问题 | KM 的解法 |
|------|-----------|
| 检索与生成混在一起会编造 excerpt | **检索层零 LLM**：规则 rank + pickExcerpt |
| 向量 alone 漏关键词 / 路径权威 | **Hybrid 召回**（Qdrant dense + sparse，引擎 RRF） |
| identity / 列举 / tech 问法差异大 | **queryProfile 分档** topK、maxHits、guard |
| 多问 composite 重复算力 | **检索 hits 缓存** + **槽答案增量**（命中槽跳过 KM） |

### 1.2 核心原则

1. **快、稳、可回归** — 主路径确定性；日志带 `queryProfile`、`recallSource`、`confidenceTier`。
2. **Intake queryType 优先** — KM 内 `inferQueryProfile` 仅脚本 / 解析失败兜底。
3. **对外只暴露 `index.ts`** — 子目录按职责拆分；外部 import 统一走 barrel。
4. **图节点在包根 `index.ts`** — 复合路径 `runKmRetrieveNode` 在本模块；多槽编排在 `composite/`；真查库在 `recall/`；单槽工人在 `slot/`。

### 1.3 技术栈

| 技术 | 文件 | 用途 |
|------|------|------|
| Qdrant dense | `@fambrain/corpus` `searchCorpusVectors` | 向量语义召回 |
| Qdrant sparse | `@fambrain/corpus` `searchCorpusSparse` | 关键词召回（入库 TF + idf） |
| 引擎 RRF | `recall/hybrid-recall.ts` → `searchCorpusHybrid` | Qdrant prefetch + weighted RRF（需镜像 ≥1.15） |
| 进程内 RRF | `recall/fusion-rrf.ts` | 单测 / 对比脚本；主链不再调用 |
| Redis / memory | `@fambrain/infra` | 检索 hits 缓存 |
| Zod | `contract/schema.ts` | hits 结构校验 |

---

## 2. 目录地图（点进来先看这个）

```text
knowledge-manager/
├── README.md              ← 本文件
├── index.ts               ← 对外 API + runKmRetrieveNode（底部）
│
├── contract/              ← index + interface + schema
├── profile/               ← index + interface + km-config / query-profile / score-candidate
├── recall/                ← index + interface + hybrid / rrf / retrieve / helpers
├── composite/             ← 多槽 merge / order（缓存见 agentflow/cache/）
└── slot/                  ← 单槽工人 + 子图壳（图节点出口在包根）
```


业界对标见 [`docs/km-retrieval-design.md`](../../../../../../docs/km-retrieval-design.md)。

### 推荐阅读顺序

1. `corpus-lister/` — 列举 preview/continue/exhaustive（目录扫盘分页）
2. `recall/retrieve.ts` — Hybrid → rank → coverage 主路径（identity/tech/external_link）
3. `agentflow/cache/` — planCacheResolve 全量 facet+hits；Analyst 写 facet 会话缓存
4. `profile/query-profile.ts` + `profile/km-config.ts` — 分档参数
5. `recall/retrieve-helpers.ts` — identityGuard、enumerationFill

---

## 3. 文件流转路径（从 decision 到 hits）

### 3.1 总览

```text
state.decision（Intake 输出）
    │
    ▼
routeAfterIntake()                    pipeline/graph/routes.ts
    │
    ├─ 纯 list（全部槽 executor=list_corpus）→ listRetriever（../corpus-lister/）
    │
    └─ 复合 / km / tool / dag → planCacheResolve（`agentflow/cache` 全量 facet+hits）
          └─ planFanOut Send：kmRetrieve（读预置 cache + FC）/ listRetrieve / …
                pathPlan 派生 slots
                  ├─ executor=km_retrieve → 预置 hits / facet 短路 + FC
                  └─ executor=list_corpus → fetchListSlot（不经 FC）
    │
    ▼
planSlotJoin 混排 → planSlotPost(tools) → planMerge
    │
    ▼
state.hits / coverage / notes / confidenceTier / stepResults
    │
    ▼
contentOrganizer → analyst
（纯 listRetriever 路径）直接 contentOrganizer → analyst
```

### 3.2 单槽检索（每槽 Send）

复合路径：`planCacheResolve` 预拼 `resolvedSub`；`slot/execute-sub`（retrieve + writeHitsCache）；`slot/index` FC。

### 3.3 单问检索内部（`retrieveKnowledge`）

```text
resolveQueryProfile(queryType, searchQuery, subTasks)
    │
    ▼
hybridRecall()              recall/hybrid-recall.ts
    searchCorpusHybrid（Qdrant 引擎 RRF）
    │
    ▼
rankCandidates + pickExcerpt    recall/retrieve-helpers.ts
    pathBoost / identityGuard / enumerationFill
    │
    ▼
assessConfidence()            profile/score-candidate.ts
deriveCoverageFromTier()
    │
    ▼
KnowledgeRetrievalResult { hits, coverage, notes, confidenceTier }
```

### 3.4 Web 运行日志里 KM 的标签

| label | 对应步骤 |
|-------|----------|
| `进入` | searchQuery、queryProfile、vectorTopK |
| `Hybrid` | vector/sparse 路数、RRF Top 路径 |
| `出去` | hitCount、coverage、confidenceTier |

---

## 4. 与 Intake / Pipeline 的边界

| 字段 | 谁写 | KM 怎么用 |
|------|------|-----------|
| `searchQuery` | Intake | 主检索文本；检索 hits 缓存 key 之一 |
| `queryType` | Intake | 映射 queryProfile；检索 hits 缓存 key 之一 |
| `routeMode` / `compositeSlots` | Intake | **`plan`（可观测）** + 1～N 槽；执行看 pathPlan |
| `topics` | Intake | **仅**拼入向量 semantic query（KM-01） |
| `subTasks` | Intake | sparse token + rank 辅助 |

列举目标解析（experience / projects）在 Intake 侧：`intake-coordinator/composite/enumeration-target.ts`，KM `retrieve.ts` 调用 `resolveEnumerationTarget`。

---

## 5. 验收脚本

| 命令 | 测什么 |
|------|--------|
| `pnpm --filter @fambrain/brain-service run verify:km-retrieve` | rank / guard / enumeration 单测 |
| `pnpm --filter @fambrain/brain-service run verify:hybrid-recall` | RRF + hybrid live |
| `pnpm --filter @fambrain/brain-service run verify:composite-route` | merge composite hits |
| `pnpm --filter @fambrain/brain-service run verify:agent-schemas` | schema 合同 |
| `pnpm --filter @fambrain/brain-service run verify:retrieval-cache` | 检索 hits 缓存 normalize |
| `pnpm --filter @fambrain/brain-service run verify:enumeration-compose` | P0-22 列举 blocks + skip LLM + 序号/文案 |
| `pnpm --filter @fambrain/brain-service run verify:enumeration-pagination` | 续问路由 + 分页 API + 槽答案 blocks |
| `pnpm exec tsx --env-file=../../.env scripts/diagnose-projects-query.ts` | 语料 36 项 vs KM/Organizer/规则路径 |

**HTTP（brain-service）：** `POST /enumeration/list` — body `{ corpusUserId, listKind, page, pageSize }`；Web BFF：`POST /api/corpus/enumeration`。
