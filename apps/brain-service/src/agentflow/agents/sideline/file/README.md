# sideline/file — 文件子线

平级 compiled graph（**不是**主图 nested subgraph）。主图 `fileHandoff` 只把信封放进 `fileEnvelope`；**runtime** `orchestrateAgentStream` 建 `FileJob` 后 `fileGraph.stream`。

## 两套 thread

| 线 | thread | discard |
|----|--------|---------|
| 问答主图 `fambrain-pipeline` | `fambrain:{conversationId}:{qaGen}` | 新问 / 生成停 / 停止 |
| 文件子图 `fambrain-file` | `fambrain-file:{conversationId}:{fileGen}` | 新文件任务 / workspace 被非原文库问顶替 / TTL 30min |

Resume **只打文件 thread**，且 HTTP/`resume.jobId` **必填**（不猜最近一个 job）。

## 图

```text
START → workspace | saveHitl → END
```

- `workspace`：CRUD interrupt 循环；列表覆写同一条 `followupMessageId`
- `saveHitl`：一次 interrupt；短 CTA（不定稿全文）；确定入库弹窗填名 / 取消

主图 `persistTurnEnd` 在交棒前已跑（写 LangMem）。本图 END **不写** LangMem。

## 信封（只信结构化字段）

`attachmentAction` / `composeMode` / `intent` / `hasPathSteps` / `hasSearchQuery` / `workspaceOp`。FileAgent **不扫用户口语**。

## 产品

- 写回：两条助手消息（主图终稿 `done` + CTA `paused`）
- 新 QA **保留** save_offer 按钮；**顶替** workspace HITL
- 同会话一个活跃 FileJob；新文件任务 supersede 旧文件 thread
- 同问短路不启动文件子线
