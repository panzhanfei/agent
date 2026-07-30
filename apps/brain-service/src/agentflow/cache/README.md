# agentflow/cache

Pipeline 缓存策略层；存储在 `packages/infra/src/cache/`。

## 目录

```text
cache/
├── facet/       facetKey + Analyst ↔ CachedFacetAnswer
├── read/        planCacheResolve：查缓存 + assemble-sub 预拼 resolvedSub
├── write/       writeHitsCache / writeFacetSession
└── km-slot/     execute：仅 resolvedSub 短路或 live retrieve + write
```

## 数据流

```text
planCacheResolve → CompositeSlotPlan.resolvedSub（命中时）
km worker        → 有 resolvedSub 直接返回；否则 retrieve + writeHits
Analyst          → writeFacetSession
```
