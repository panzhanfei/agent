# PlanFanOut（复合路径编排）

**只负责 fan-out 编排链**：Send 派发 → 槽汇合 → 与 DAG 线 merge。  
retrieve / tools / userFact side-effect 的**图节点**分别在 `knowledge-manager`、`corpus-lister`、`tool-orchestrator`、`user-fact`。

## 图节点（本包）

| 节点 | 目录 | 职责 |
|------|------|------|
| — | `fan-out/` | `fanOutPlanWorkers()`：Send km/list/dag/userFactSide |
| `runPlanSlotJoinNode` | `plan-slot-join/` | 等槽工人汇合，混排 subResults |
| `runPlanMergeNode` | `plan-merge/` | 汇合 slot 线 + dag 线 → stepResults |

## 关联 Agent 图节点（不在本包）

| 节点 | Agent |
|------|-------|
| `runKmRetrieveNode` | `knowledge-manager` |
| `runListRetrieveNode` | `corpus-lister` |
| `runUserFactSideNode` | `user-fact/side` |
| `runPlanSlotPostNode` | `tool-orchestrator/plan-slot-post` |
| `runPlanDagNode` | `tool-orchestrator/plan-dag` |

## 目录

```text
plan-fanout/
├── index.ts          # 只聚合 fan-out / join / merge
├── interface.ts      # fanOutSlotPatches / fanOutSlotPatch 通道类型
├── fan-out/
├── active-slot/      # resolveActiveSlot（Send 工人共用）
├── merge/
├── plan-slot-join/
└── plan-merge/
```

## 链路

```text
intake → Send(kmRetrieve×N | listRetrieve×M | planDag | userFactSide)
         kmRetrieve（FC）/ listRetrieve（无 FC）/ userFactSide → planSlotJoin → planSlotPost(tools) → planMerge
         planDag ────────────────────────────────────────────────→ planMerge
```
