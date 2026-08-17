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
| **代码** | 状态机、预算、Abort、deps 裁剪、DAG seed+闭包再批、`emptyPolicy` 合法化 | 问句词表、场景名、Mem0 字段名表猜意图 |

**单槽作用域：** B 产出的补丁只改对应槽的结构化字段（`searchQuery` / `toolId` / `webQuery` / `executor`…），不是「每槽各开一轮规划」。  
**DAG 再批：** 仍 `Send("planDag")`，但 `executeDagPlan` 用首遍 `toolResults` 作 seed，只重跑 `forceRerunIds ∪ 下游闭包`，成功节点复用（非整图盲重跑）。

## 2. 槽状态机

`pending → running → done | skipped`  
`running → aborted`（Turn 取消 / supersede）  
图级人等：仅原文库 `interrupt({ kind: vault_wait })`（工作台 CRUD 循环 + 写回闸门一次确认）。槽状态机无 `awaiting_human`。生成停用 `gen_pause` 截停采样后 **discard**，不 Resume。

| 状态 | 含义 |
|------|------|
| `pending` | 已进 plan，未拉起 |
| `running` | 工人/子图执行中 |
| `done` | 有可用结果（可带 `degraded`） |
| `skipped` | 超时 / 预算用尽 / deps 失败 / 错误（用 `reason` 区分，不另造 `failed`） |
| `aborted` | Turn 作废，禁止写回 |

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
- **两模式：** 问答主路径 = **停 / 换题 → discard + 新一轮**（无 Resume）；**Resume 只给原文库 HITL 按钮**（工作台 + 写回闸门）  
- 再发下一句 = **supersede**（默认）= discard 图任务（世代 +1）  
- **原文库人等** = `interrupt({ kind: vault_wait })` + checkpointer；点按钮 = 同 thread `Command({ resume: vault_action })`（写回闸门可带 `name`）  
- **生成停** = 截停采样，半截稿落库为终稿，discard；无「继续」  
- **HITL 载荷** = `interrupt` value（`answer`/`blocks`）。stream `values` 合入已有 channel，禁止整帧覆盖  
- 双保险：Abort 断流 + cancel API  
- 落库：cancelled 有正文 → 截停 +「——用户已暂停」；superseded 不写旧 assistant；生成停按普通 `done` 写半截稿（无该后缀）

## 5. 指代续问

- 废除 Plan 级指代拼接重试；单次 Understand+Plan；消不了 → clarify  

## 6. 动态规划（原 FactChecker 闭环已删除）

- **已删除** `fact-checker/` 模块与主链 FC 图节点 / 打回再检索环  
- 改 query / 外搜再试 **只**发生在 Join 后全局 B（≤1），结构化补丁  
- Tool：结构失败可 `toolId=search_web` + query；成功不准 → 不验真，回答层标注/降级  
- **不做**过半失败整句重规划  
- FactChecker 模块已删；`StepResult` 无 `fc` 字段  

## 7. 子图与 DAG

- km / list / mem / tool / summarize / vaultWorkspace：扁平工人（`emitBudgetedSlotPatch` + worker）  

- DAG：**不**另起规划器；失败信号并进同一 B  
- DAG **动态裁剪**：`deps` + `optionalDeps`（soft）；仅 hard 未满足才 skip；soft 失败 → 下游可继续并 `degraded`/备注  
- DAG **部分再批**：`pendingGlobalRebatchDagNodeIds` + `fanOutDagPatch.toolResults` seed；`collectDownstreamRerunClosure`；`canReuseDagNodeResult`（deps-skip / 失败不可复用）  
- **`emptyPolicy`**：`require` \| `omit` \| `degrade`（pathPlan 步 / 槽 / DAG 节点）。hybrid 默认：resume=`require`，company/market=`omit`，synthesis=`degrade`。planMerge 强制 require；omit 空步从 stepResults 去掉；omit 不进全局 B 候选  

## 8. 实现阶段

0 约定 → 1 状态机+预算+DAG 裁剪 → 2 Turn 取消 → 3 子图壳 → 4 全局 B → 5 写时去重+翻译 → **6 HITL** → **6b DAG seed+闭包再批 + emptyPolicy（2026-08）** → 7 Eval → **8 Dify/复盘（含 P0-34：换模型后删猜意图兜底）**

**阶段 8 备忘（P0-34）：** Dify 抽离 + 换更强 Intake 模型后，跑通 GMem / 六连问 QQ / 亲友等 eval，再删除 `from-llm.ts` 亲友改写、`km-*`→mem 抬升、空 plan→remember、问句年龄 regex 等「猜 LLM 本意」代码。清单：[坑点 §2.11](./04-pitfalls.md#211-猜模型意图兜底债-p0-34--与-dify-抽离同批--2026-08) · [架构 v2 §14](./05-architecture-v2-tool-orchestration.md#14-猜模型意图兜底债--dify换模型后删除-p0-34--2026-08)。

### 阶段 5 定稿（补充）

- **写时去重**：仅结构化 `factKey`；同 key 同值 skip，异值删旧再写；挂在 `addStructuredUserFact`
- **翻译**：`toolId=translate_text`；结构化 `text`（searchQuery）+ `targetLang`；供应商有道（`YOUDAO_APP_KEY`/`SECRET`）；无凭证 → disabled；无 Ollama fallback
- **不做**：口语词表触发；本阶段不大改 golden 全表  

### 阶段 6 定稿（原文库写盘）

HITL 直接改 `corpus/**/*.md` 的 `corpus_edit` 已删除。写盘只走 VaultWrite：

| 路径 | 图节点 | 写什么 | HITL |
|------|--------|--------|------|
| 工作台 | `vaultWorkspace` | 用户 CRUD workspace `.txt` | interrupt 循环 +「结束」 |
| 写回闸门 | `vaultSaveGate`（独立 Agent） | 附件/粘贴终稿 → `.txt` | 一次暂停；确定入库弹窗填名 / 取消。查库摘要不出闸 |
| 语料页批量 | （不在聊天图内） | 原件 → corpus | 无；`ingestDocumentBatch` |

聊天附件 **不再 ingest**；要入库先总结或翻译，再走写回闸门。

Eval：`golden.json` → `vaultWorkspaceProbe`（含 `save_gate_*`）；`eval:run -- --vault-only`。

### 记忆分层（自学重设计）

| 层 | 职责 | 写入口 |
|----|------|--------|
| Working | 图 state | 运行时 |
| LangMem | 会话摘要 → Prisma `Conversation.sessionSummary` | `persistPipelineMemory` |
| Mem0 | 跨会话结构化用户事实 → Qdrant `fambrain_user_memories` + history.db | 显式 remember / 静默 `user-memory-extract` |
| Corpus/Qdrant | 知识库 | **vault_workspace** materialize/purge / 入库脚本（**禁止**静默自学写） |

- **废除**：整轮 `addTurnToMem0`；旧 Learning pending / auto corpus / `/learning` HITL  
- **静默自学**：`USER_MEMORY_AUTO_LEARN_ENABLED` 默认 **false**；独立 LLM（非 Intake）；只信抽取 JSON + Zod；不写 corpus  

## 9. 代码兜底白名单（仅此）

1. Zod/schema 合法化（含 `emptyPolicy` → require/omit/degrade，非法→degrade）  
2. 按结构化 key 去重/合并  
3. 空 plan / 解析失败 → clarify  
4. JSON 格式修复 **1** 次  
5. deps 未满足（hard）→ 下游 skip；soft 不阻断  
6. 预算/Abort 到点强制终态  
7. 进 B 的候选：结构信号（error / coverage none / tool `ok:false` / skipped…），非口语；**omit 不进 B**  
8. DAG 再批：seed 复用 + force 下游闭包（结构边）  
9. planMerge：`require` 仍空 → 结构化 error；`omit` 空步从 stepResults 省略  

详见 `.cursor/rules/no-scene-hardcoding.mdc`。  

验证：`pnpm --filter @fambrain/brain-service run verify:dag-partial-reexec`；单测 `tests/execution/dag-partial-reexec.test.ts`、`empty-policy.test.ts`。
