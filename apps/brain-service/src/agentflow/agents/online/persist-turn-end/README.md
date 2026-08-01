# PersistTurnEnd

LangGraph **END 前**最后一个在线节点（非图内 LLM）。

## 职责

1. `persistPipelineMemory` — LangMem 会话摘要（不再整轮 `addTurnToMem0`）
2. `persistUserMemoryAutoLearnAfterTurn` — 可选静默结构化记忆（`USER_MEMORY_AUTO_LEARN_ENABLED`；本轮显式 `userFact` / remember|recall 跳过）

## 不负责

- 显式 `remember_user_fact`（`user-fact` 节点）
- 检索 👍👎（`RetrievalFeedback`）
- 语料文件写入（未来 HITL）
