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
