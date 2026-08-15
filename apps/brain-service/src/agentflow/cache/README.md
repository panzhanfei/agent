# agentflow/cache

Pipeline 缓存策略层（读 / 写）；存储在 `packages/infra/src/cache/`。

## 目录

```text
cache/
├── facet/       facetKey + Analyst ↔ CachedFacetAnswer
├── read/        planCacheResolve + assemble-sub（预拼 resolvedSub）
└── write/       writeHitsCache / writeFacetSession
```

## 数据流

```text
planCacheResolve → plan.resolvedSub
knowledge-manager/slot/execute-sub → 消费 resolvedSub 或 retrieve + writeHitsCache
Analyst → writeFacetSession
```

## facetKey（成稿）

会话 Redis 键：`conversationId + corpusUserId`。包内每条：

```text
{queryType桶}:{字段或列举类}:{归一化 searchQuery}[:p{页码}]
```

| 例 | 含义 |
|---|---|
| `id:age:今年多大` | identity + age，问法进键 |
| `id:age:按农历多大` | 与上条并存，不覆盖 |
| `enum:projects:项目经历 全部项目:p2` | list 第 2 页 |

只信 Intake 结构化字段。换口命中靠 Intake 写出同一 `searchQuery`，不把成稿收成 `id:age` 单坑。

## hits（KM 检索）

```text
{prefix}:retrieval:v1:{corpusUserId}:{queryType}:{归一化 searchQuery}
```

与 facet 一样带 `searchQuery`；不按 identity 字段单坑覆盖。
