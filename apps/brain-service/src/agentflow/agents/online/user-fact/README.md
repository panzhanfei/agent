# UserFact（用户自述记忆）

跨会话 **remember / recall** 用户联系方式等结构化事实（QQ、微信、手机…），经 Mem0 持久化。

Mem0 / LangMem 在 **`preparePipelineMemory`** 加载；本模块负责 Intake JSON 解析、图节点读写 Mem0。

---

## 图节点（包根 `index.ts` + `side/`）

| 节点 | 路径 | 何时进入 |
|------|------|----------|
| `userFactNode` | `index.ts` | Intake 纯 remember/recall 路由；绕过 KM / FC / Analyst |
| `runUserFactSideNode` | `side/` | 复合路径 planFanOut Send：与检索并行写 remember，文案并入 Analyst 终稿 |

---

## 目录

```text
user-fact/
├── index.ts       # userFactNode + barrel
├── user-fact.ts   # 路由解析、校验、话术、Mem0 行解析
└── side/          # runUserFactSideNode（planFanOut 并行 side-effect）
```

---

## 图内位置

**纯 userFact 路径：**

```text
preparePipelineMemory → intake → routeAfterIntake → userFact → persistTurnEnd
```

**复合 + remember side-effect：**

```text
intake → planFanOut Send(userFactSide ∥ km/list…) → planSlotJoin → … → Analyst 并入 sideEffectAnswer
```

验证：`pnpm run verify:user-fact`
