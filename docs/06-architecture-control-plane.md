# 架构约定：控制面 / 动态规划（阶段 0～4 定稿）

> 目标：业界可讲述的 Agent 编排完整性。  
> **铁律：不许硬编码。** 代码只做 schema 合法化与结构兜底；语义（意图、指代、补检策略）归 LLM / 结构化字段。

## 1. 总分层

```text
Understand + Plan（可融合为一次 LLM）
    → Execute（多槽 / DAG 并行首遍）
    → Join 汇合
    → 全局协调 B（对失败/不可用槽统一动态规划，最多 1 次，再批执行）
```

| 层 | 职责 | 禁止 |
|----|------|------|
| **Understand+Plan** | 续问指代、pathPlan 终稿；`unresolved` → clarify | Plan 级指代拼接重试；口语二次拆槽 |
| **首遍 Execute** | 槽/子图执行；DAG hard/soft 结构裁剪 | 工人内 FC 改 query 再检；每槽规划 LLM |
| **全局 B** | 汇合后对**有问题的槽**（及可救的 DAG 节点信号）**统一一次**规划 LLM → 结构化补丁 → 再批 | 每槽单独规划；过半整句重 Intake；改槽列表/answerOrder |
| **代码** | 状态机、预算、Abort、deps 裁剪、非法字段降级 | 问句词表、场景名、Mem0 字段名表猜意图 |

**单槽作用域：** B 产出的补丁只改对应槽的结构化字段（`searchQuery` / `toolId` / `webQuery` / `executor`…），不是「每槽各开一轮规划」。

## 2. 槽状态机

`pending → running → done | skipped | awaiting_human`  
`running → aborted`（Turn 取消 / supersede）

| 状态 | 含义 |
|------|------|
| `pending` | 已进 plan，未拉起 |
| `running` | 工人/子图执行中 |
| `done` | 有可用结果（可带 `degraded`） |
| `skipped` | 超时 / 预算用尽 / deps 失败 / 错误 / 用户拒绝（用 `reason` 区分，不另造 `failed`） |
| `aborted` | Turn 作废，禁止写回 |
| `awaiting_human` | HITL 占位（写文件模式） |

**部分结果：** 本槽有弱/部分可用 hits → `done` + `degraded`；完全无可用或超时砍掉 → `skipped`。

## 3. 预算（初值统一）

```ts
{ maxAttempts: 2, deadlineMs: 60_000 }
```

| 变量 | 含义 |
|------|------|
| `SLOT_MAX_ATTEMPTS` | 单槽最多 attempt（含首次） |
| `SLOT_DEADLINE_MS` | 单槽墙钟 |
| `SLOT_GLOBAL_REBATCH_ENABLED` | 未设/`1` → 允许全局 B；`0`/`false` → 关闭 |

- 单槽生涯 **严格 ≤ maxAttempts**；全局 B 再批不得加成超出  
- 超时主路径：工人内 race；Join 兜底补标  

## 4. Turn / 取消

- 每次用户提交 = 新 `turnId`（**Web 生成并贯穿**；Brain 缺省时兜底）  
- 再发下一句 = **supersede**（默认）  
- **cancel + supersede**；任意点 resume 不做（resume 仅 HITL）  
- 双保险：Abort 断流 + cancel API  
- 落库：cancelled 有正文 → 截停 +「——用户已暂停」；superseded 不写旧 assistant  

## 5. 指代续问

- 废除 Plan 级指代拼接重试；单次 Understand+Plan；消不了 → clarify  

## 6. FactChecker / 动态规划

- **废除**工人内 FC「评估 + `refinedSearchQuery` 再检索」；主路径不再调用该环  
- 改 query / 外搜再试 **只**发生在 Join 后全局 B（≤1），结构化补丁  
- Tool：结构失败可 `toolId=search_web` + query；成功不准 → 不验真，回答层标注/降级  
- **不做**过半失败整句重规划  

## 7. 子图与 DAG

- km + tool = 单槽子图壳（阶段 3）；首遍执行入口；再批仍进同一壳  
- list/mem/summarize：扁平  
- DAG：**不**另起规划器；失败信号并进同一 B  
- DAG **动态裁剪**：`deps` + `optionalDeps`（soft）；仅 hard 未满足才 skip；soft 失败 → 下游可继续并 `degraded`/备注  

## 8. 实现阶段

0 约定 → 1 状态机+预算+DAG 裁剪 → 2 Turn 取消 → 3 子图壳 → 4 全局 B → **5 写时去重+翻译（本阶段）** → 6 HITL → 7 Eval → 8 Dify/复盘  

### 阶段 5 定稿（补充）

- **写时去重**：仅结构化 `factKey`；同 key 同值 skip，异值删旧再写；挂在 `addStructuredUserFact`
- **翻译**：`toolId=translate_text`；结构化 `text`（searchQuery）+ `targetLang`；供应商有道（`YOUDAO_APP_KEY`/`SECRET`）；无凭证 → disabled；无 Ollama fallback
- **不做**：口语词表触发；本阶段不大改 golden 全表  

### 记忆分层（自学重设计）

| 层 | 职责 | 写入口 |
|----|------|--------|
| Working | 图 state | 运行时 |
| LangMem | 会话摘要 | `persistPipelineMemory` |
| Mem0 | 跨会话结构化用户事实 | 显式 remember / 静默 `user-memory-extract` |
| Corpus/Chroma | 知识库 | HITL / 入库脚本（**禁止**静默自学写） |

- **废除**：整轮 `addTurnToMem0`；旧 Learning pending / auto corpus / `/learning` HITL  
- **静默自学**：`USER_MEMORY_AUTO_LEARN_ENABLED` 默认 **false**；独立 LLM（非 Intake）；只信抽取 JSON + Zod；不写 corpus  

## 9. 代码兜底白名单（仅此）

1. Zod/schema 合法化  
2. 按结构化 key 去重/合并  
3. 空 plan / 解析失败 → clarify  
4. JSON 格式修复 **1** 次  
5. deps 未满足（hard）→ 下游 skip；soft 不阻断  
6. 预算/Abort 到点强制终态  
7. 进 B 的候选：结构信号（error / coverage none / tool `ok:false` / skipped…），非口语  

详见 `.cursor/rules/no-scene-hardcoding.mdc`。
