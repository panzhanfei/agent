# 架构约定：控制面 / 单槽动态规划（阶段 0 定稿）

> 目标：业界可讲述的 Agent 编排完整性。  
> **铁律：不许硬编码。** 代码只做 schema 合法化与结构兜底；语义（意图、指代、补检策略）归 LLM / 结构化字段。

## 1. 总分层

```text
Understand + Plan（可融合为一次 LLM）
    → Execute（多槽并行；单槽子图内 L1 动态规划）
    → 全局协调 B（失败过半时再批一轮 L1，不重跑 Intake）
```

| 层 | 职责 | 禁止 |
|----|------|------|
| **Understand+Plan** | 续问指代、pathPlan 终稿；`unresolved` → clarify | Plan 级指代拼接重试；口语二次拆槽 |
| **L1 单槽** | 证据不足时槽内补步（收编原 FC）；改本槽 query/再执行 | 增删其它槽、改 answerOrder、改 pathPlan 结构 |
| **全局 B** | 失败槽数 ≥ ceil(n/2) 时，对未满预算的失败槽再批 L1，**最多 1 次** | 重跑 Intake；改槽列表 |
| **代码** | 状态机、预算、Abort、deps 裁剪、非法字段降级 | 问句词表、场景名、Mem0 字段名表猜意图 |

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

环境变量（根目录 `.env` / `.env.example`）：

| 变量 | 含义 |
|------|------|
| `SLOT_MAX_ATTEMPTS` | 单槽最多 attempt（含首次） |
| `SLOT_DEADLINE_MS` | 单槽墙钟；工人内 `Promise.race` |
| `SLOT_GLOBAL_REBATCH_ENABLED` | `1` 时 Join 打全局 B 候选日志（阶段 4 再真批） |

- 单槽生涯 **严格 ≤ maxAttempts**；全局 B 不得加成超出  
- 超时主路径：工人内 race；Join 兜底补标  
- tool 等以后再按 executor **分档**，初值不分档  

## 4. Turn / 取消

- 每次用户提交 = 新 `turnId`；编辑重发 = 新 `turnId`，旧 turn → `aborted`  
- 阶段实现：**cancel + supersede**；**任意点 resume 不做**  
- **resume 仅 HITL**（`awaiting_human` → 批准后继续）  

## 5. 指代续问（与动态规划边界）

- **废除** `coreference=unresolved` 后拼接再调 Intake 的旁路  
- 单次融合 Understand+Plan；消不了 → **clarify**  
- 代码可把上轮实质问作为**结构化上下文字段**喂入（输入增强，不是第二次规划）  
- 若仍失败 → **模型/提示问题**，不在 Execute 用规则补丁兜；换模型或加强上下文再优化  

## 6. FC

- 现有 FactChecker 重检环 **并入 L1 单槽动态规划**，不再并行一套 FC 产品语义  
- 判据仍可以是 LLM，归属「槽内规划」  

## 7. 子图

- km（及需要时 tool）= **单槽子图**，承载 L1 环  
- 父图：cache resolve → Send → Join → Merge  
- list/mem：先仅超时/取消，不强行上 L1  

## 8. 实现阶段顺序（提醒）

0 本约定 → 1 状态机+预算+DAG 裁剪 → 2 Turn 取消 → 3 子图壳 → 4 L1 环 → 5 写时去重+翻译 → 6 HITL → 7 Eval → 8 Dify/复盘  

## 9. 代码兜底白名单（仅此）

1. Zod/schema 合法化  
2. 按结构化 key 去重/合并  
3. 空 plan / 解析失败 → clarify  
4. JSON 格式修复 **1** 次（输出纪律，非指代触发器）  
5. deps 未满足 / 上游 `ok=false` → 下游 skip（结构裁剪）  
6. 预算/Abort 到点强制终态  

详见 `.cursor/rules/no-scene-hardcoding.mdc`。
