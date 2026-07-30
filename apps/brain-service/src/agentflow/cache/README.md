# agentflow/cache（Pipeline 缓存策略层）

Brain 域内 **facet 会话缓存** 与 **检索 hits 缓存** 的统一入口；底层存储仍在 `packages/infra/src/cache/`。

## 分层

| 层 | 路径 | 职责 |
|----|------|------|
| 存储 | `packages/infra/src/cache/` | Redis key、TTL、get/set |
| 策略 | `agentflow/cache/`（本目录） | facetKey、全量 resolve、hits 预查、Analyst 写回 |

## 调用点

| 节点 / 模块 | API |
|-------------|-----|
| `planCacheResolve`（fan-out 前） | `resolveCompositeCachePlan`（facet 全槽 + km hits 预查） |
| `kmRetrieve` worker | 读 `state.compositeIncrementalPlan`；FC 重检 → `retrieveKmWithHitsCache` |
| `planSlotJoin` | 复用 state 内 plan，不再重复 resolve |
| `listRetriever` | `resolveCompositeCachePlan({ prefetchHits: false })` |
| Analyst `stream-composite` | `writeFacetSession` + `analystResultToCachedFacet` |

## 文件

```text
cache/
├── index.ts
├── interface.ts           # CompositeCachePlan / CompositeSlotPlan
├── facet-key.ts           # buildFacetKey / attachFacetKey
├── resolve-composite-plan.ts
├── slot-hits.ts           # lookupHitsCache / retrieveKmWithHitsCache
├── facet-bridge.ts        # Analyst ↔ CachedFacetAnswer
├── write-session.ts
└── sub-from-plan.ts       # facet/hits → CompositeSubRetrieval
```

## 图位置

```text
intake → planCacheResolve → planFanOut Send → kmRetrieve / … → planSlotJoin
```
