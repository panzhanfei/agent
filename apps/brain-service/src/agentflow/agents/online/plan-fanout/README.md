# plan-fanout

Intake 之后的并行工人汇合：`Send` 每槽检索/工具/记忆/总结 ∥ DAG ∥ remember side-effect。

## 图

```text
intake → planCacheResolve（agentflow/cache）
     → planFanOut Send
├── kmRetrieve      读预置 facet+hits cache + FC
├── listRetrieve    PathKind=list     dataSource=corpus          → list，无 FC
├── memRetrieve     PathKind=mem      dataSource=mem0            → Mem0 结构化召回
├── toolRetrieve    PathKind=tool     dataSource=web|…           → 独立工具（search_web 等）
├── summarizeSlot   PathKind=summarize dataSource=user_text      → 子步总结
├── userFactSide    remember side-effect
└── planDag         PathKind=dag

        ↓ planSlotJoin
        ↓ planSlotPost     ← 仅 post-retrieval toolId（age/identity/links/compose_enumeration）
        ↓ planMerge
        ↓ contentOrganizer
        ↓ contentSummarizer?  ← 仅整轮 composeMode=summarize
        ↓ analyst
```

## 扩展独立工具

1. `TOOL_RUN_IDS` 增加 id  
2. `runExecutionPlanNode` switch 增加 case  
3. **不要**加入 `POST_RETRIEVAL_TOOL_IDS` → 自动走 `toolRetrieve`  

无需新 PathKind / 新 Send 工人。

## 结构归一（无字段名表）

`normalizePathPlanSteps`：信 `dataSource` / `userFactKey` / `identityField` / toolId 族修正 kind。  
单步 `mem` → Intake 折叠为 `recall_user_fact` 早退。
