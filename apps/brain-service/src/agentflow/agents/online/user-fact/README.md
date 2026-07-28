# UserFact（用户自述记忆）

跨会话 **remember / recall** 用户联系方式等结构化事实（QQ、微信、手机…），经 Mem0 持久化。

Mem0 / LangMem 在 **`preparePipelineMemory`** 加载；本模块负责 Intake JSON 解析、图节点读写 Mem0。

---

## 图节点

| 节点 | 路径 | 何时进入 |
|------|------|----------|
| `userFactNode` | `index.ts` | 纯 remember/recall；或 Intake 将**单步 mem** 结构折叠为 recall 早退 |
| `runMemRetrieveNode` | `mem-retrieve/` | 复合 pathPlan 中 `kind=mem` 槽：并行召回，写入 `recalledFact` |
| `runUserFactSideNode` | `side/` | 复合 + 顶层 userFactKey/Value：并行写 remember |

---

## 目录

```text
user-fact/
├── index.ts         # userFactNode + barrel
├── user-fact.ts     # 路由解析、校验、话术、Mem0 行解析
├── mem-retrieve/    # runMemRetrieveNode（复合 mem 槽）
└── side/            # runUserFactSideNode（remember side-effect）
```

---

## 图内位置

**纯 userFact 路径：**

```text
preparePipelineMemory → intake → routeAfterIntake → userFact → persistTurnEnd
```

**复合 + mem 召回 / remember side-effect：**

```text
intake → planFanOut Send(memRetrieve ∥ userFactSide ∥ km/list…)
  → planSlotJoin → planSlotPost → planMerge → Analyst（信 recalledFact / sideEffectAnswer）
```

**结构规则：** 语料 identity 用 `identityField` 闭集（km）；自述字段用 `userFactKey` 开集 + `dataSource=mem0`（mem）。禁止 Mem0 字段名硬编码表。
