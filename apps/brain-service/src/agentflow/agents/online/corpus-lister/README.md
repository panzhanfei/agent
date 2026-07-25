# CorpusLister（语料目录列举）

纯 **list_corpus** 路径：按 `projects/`、`experience/` 目录扫盘分页，**不经 KM hybrid**。

## 图节点

| 节点 | 文件 | 何时进入 |
|------|------|----------|
| `listRetriever` | `nodes/list-retriever-node.ts` | Intake 后 `isPureListDecision`：全部槽 `executor=list_corpus`，且无 km/tool/dag |

**短路径：** `intake → listRetriever → contentOrganizer → analyst → persistTurnEnd`（跳过 planExecutor / contentSummarizer / FC / tool）。

**摊平：** 纯 list 用 `flattenListRetrieval`（corpus-lister 内），**不**调用 KM `mergeCompositeRetrieval`；混槽 list 仍在 planExecutor / `runRetrievalNode` 里与 km 一并 merge。

## 目录

```text
corpus-lister/
├── index.ts
├── interface.ts
├── fetch-list-slot.ts      # 单槽 list 检索（listRetriever + composite 共用）
├── flatten-list-retrieval.ts  # 纯 list 摊平 hits/meta（不经 KM merge）
├── pure-list-route.ts      # isPureListDecision
├── list/
│   ├── list-corpus-entries.ts
│   ├── retrieve-enumeration-page.ts
│   └── entry-time-window.ts
└── nodes/
    └── list-retriever-node.ts
```

## 与 KnowledgeManager 边界

| | CorpusLister | KnowledgeManager |
|---|---|---|
| 触发 | exhaustive / continue / UI 分页 | identity / tech / preview 列举 / 复合 km 槽 |
| 机制 | path 排序 + slice | hybrid（vector ∥ sparse）+ rank + confidence |
| 图节点 | `listRetriever` | planExecutor 内 `runRetrievalNode` |

HTTP：`POST /enumeration/list`（`server/enumeration-list.ts`）同样走本模块 `listCorpusEntriesPage`。
