# plan-fanout

Intake 之后的并行工人汇合：`Send` 每槽检索/工具/记忆/总结 ∥ DAG ∥ remember side-effect。

## 图

```text
intake → planCacheResolve（agentflow/cache）
     → planFanOut Send
├── kmRetrieve      读预置 facet+hits cache（无工人内 FC）
├── listRetrieve    PathKind=list     dataSource=corpus
├── memRetrieve     PathKind=mem      dataSource=mem0
├── toolRetrieve    PathKind=tool     dataSource=web|…
├── summarizeSlot   PathKind=summarize dataSource=user_text
├── vaultWorkspace  PathKind=vault_workspace（interrupt 循环；成功不进 Join）
├── userFactSide    remember side-effect
└── planDag         PathKind=dag（与槽同一 Join）

        ↓ planSlotJoin
        ↓ 全局 B?（结构可救槽/节点 → 一次 LLM 补丁 → 再批 Send ≤1）
        ↓ planSlotPost     ← 仅 post-retrieval toolId
        ↓ planMerge
        ↓ contentOrganizer → contentSummarizer? → analyst
```

## 扩展独立工具

1. `TOOL_RUN_IDS` 增加 id  
2. `runExecutionPlanNode` switch 增加 case  
3. **不要**加入 `POST_RETRIEVAL_TOOL_IDS` → 自动走 `toolRetrieve`  

独立工具一般无需新 PathKind。原文库 CRUD 走 `vault_workspace` → Send `vaultWorkspace`（节点内 interrupt，不经预算槽工人）。

## 结构归一（无字段名表）

`normalizePathPlanSteps`：信 `dataSource` / `userFactKey` / `identityField` / toolId 族修正 kind。  
单步 `mem` → Intake 折叠为 `recall_user_fact` 早退。
