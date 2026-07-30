# CorpusLister（语料目录列举）

纯 **list_corpus** 路径：按 `projects/`、`experience/` 目录扫盘分页，**不经 KM hybrid**。

## 图节点（包根 `index.ts`）

| 节点 | 何时进入 |
|------|----------|
| `runListRetrieverNode` | Intake 后 `isPureListDecision`：全部槽 `executor=list_corpus`，且无 km/tool/dag |
| `runListRetrieveNode` | 复合路径 planFanOut Send 工人（单槽 list，**不经 FC**） |

**短路径：** `intake → listRetriever → contentOrganizer → analyst → persistTurnEnd`（跳过 planFanOut / contentSummarizer）。

**摊平：** 纯 list 用 `flattenListRetrieval`（`flatten/`），**不**调用 KM `mergeCompositeRetrieval`；混槽 list 由 plan-fanout 每槽 Send 后在 `planSlotJoin` 混排。

**Composite plan：** 纯 list 在 `listRetriever` 内调用 `resolveCompositeCachePlan`（仅 facet，不预查 hits）。

**列举续页：** 游标在 assistant **`enumeration` blocks**（`page` / `pageSize`）；`list_corpus` 分页槽 facetKey 为 `enum:projects:p{N}`（按 `enumerationPage` 分桶，防 continue 命中上一页 cache）；Analyst 单槽流式用 `sliceHitsForAnalystStream` 信 `enumerationMeta.pageSize`，不用 profile `maxHits=8` 截断整页。

## 目录

```text
corpus-lister/
├── index.ts              # runListRetrieverNode / runListRetrieveNode + barrel
├── interface.ts
├── fetch-list-slot/      # 单槽 list 检索
├── flatten/              # 纯 list 摊平 hits/meta
├── route/                # isPureListDecision
├── slot/                 # 复合路径 listRetrieve Send 工人
├── enumeration/
└── list/
```

## 与 KnowledgeManager 边界

| | CorpusLister | KnowledgeManager |
|---|---|---|
| 触发 | exhaustive / continue / UI 分页 | identity / tech / preview 列举 / 复合 km 槽 |
| 检索 | 目录扫盘 + 分页 | hybrid vector ∥ sparse |
| 图节点 | `listRetriever` / `listRetrieve` | `kmRetrieve` |
