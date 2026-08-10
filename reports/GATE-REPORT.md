# FamBrain 工程门禁总报表

- **汇总状态**: FAIL
- **分项**: unit:PASS · eval:FAIL · load:PASS · e2e:PASS
- **最后更新**: 2026-08-10T10:40:26.714Z
- **目录**: `reports/`
- **机器可读**: `reports/{unit,eval,load,e2e}-report.json`
- **写入策略**: 分项覆盖；GATE 按段覆盖合并（非历史累加）

> 分层门禁：unit / eval / load / e2e。Load 含 health+队列+对话全链路；E2E 含 vault 与对话主链。

<!-- GATE-SECTION:unit -->

# 单元测试

- **结果**: PASS
- **生成时间**: 2026-08-10T10:33:46.771Z

### 汇总

| 指标 | 值 |
|---|---|
| exitCode | 0 |
| total | 171 |
| passed | 171 |
| failed | 0 |
| pending | 0 |
| elapsedMs | 61826 |

### 按文件

| 文件 | passed | failed | total |
|---|---:|---:|---:|
| `packages/auth/src/national-id.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/bm25.test.ts` | 2 | 0 | 2 |
| `packages/corpus/src/recall-tokenize.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/workspace-fs.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/workspace-paths.test.ts` | 3 | 0 | 3 |
| `packages/test-kit/src/check-dependency-tree.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/content-summarizer/build-source-text.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/content-summarizer/summarize-route.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/corpus-lister/pure-list-route.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/execution/control-plane.test.ts` | 11 | 0 | 11 |
| `apps/brain-service/tests/execution/global-rebatch.test.ts` | 9 | 0 | 9 |
| `apps/brain-service/tests/execution/slot-subgraph-shell.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/hitl-write/compose-and-lifecycle.test.ts` | 7 | 0 | 7 |
| `apps/brain-service/tests/hitl-write/path-plan-corpus-edit.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/hitl-write/paths-and-actions.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/hitl-write/propose-abc.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts` | 6 | 0 | 6 |
| `apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts` | 12 | 0 | 12 |
| `apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts` | 8 | 0 | 8 |
| `apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts` | 7 | 0 | 7 |
| `apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/pipeline/routes-after-organizer.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/tools/compute-age.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tools/compute-tenure.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/tools/external-link-query-regression.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tools/extract-tools.test.ts` | 11 | 0 | 11 |
| `apps/brain-service/tests/tools/translate-lang.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/user-memory-extract/legalize.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts` | 5 | 0 | 5 |
| `packages/db/src/repos/conversations-edit.test.ts` | 4 | 0 | 4 |
| `packages/infra/src/cache/keys.test.ts` | 2 | 0 | 2 |

### 失败用例

_无_

### 终端尾部

```

 RUN  v3.2.7 /Users/panzhanfei/Desktop/个人/project/own/fambrain-agents

 ✓ packages/test-kit/src/check-dependency-tree.test.ts (3 tests) 45ms
 ✓ apps/brain-service/tests/tools/external-link-query-regression.test.ts (4 tests) 47ms
 ✓ packages/db/src/repos/conversations-edit.test.ts (4 tests) 871ms
   ✓ editRegenerateMessageBodySchema > accepts content and optional turnId  627ms
 ✓ apps/brain-service/tests/execution/control-plane.test.ts (11 tests) 65ms
 ✓ apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts (3 tests) 113ms
 ✓ apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts (2 tests) 24ms
 ✓ apps/brain-service/tests/tools/extract-tools.test.ts (11 tests) 85ms
 ✓ packages/corpus/src/recall-tokenize.test.ts (3 tests) 26ms
 ✓ packages/corpus/src/workspace-fs.test.ts (3 tests) 158ms
 ✓ apps/brain-service/tests/execution/global-rebatch.test.ts (9 tests) 86ms
 ✓ packages/auth/src/national-id.test.ts (3 tests) 39ms
 ✓ apps/brain-service/tests/hitl-write/compose-and-lifecycle.test.ts (7 tests) 48ms
 ✓ apps/brain-service/tests/hitl-write/propose-abc.test.ts (5 tests) 36ms
 ✓ apps/brain-service/tests/tools/compute-tenure.test.ts (3 tests) 42ms
 ✓ apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts (2 tests) 30ms
 ✓ apps/brain-service/tests/tools/compute-age.test.ts (4 tests) 70ms
 ✓ apps/brain-service/tests/hitl-write/paths-and-actions.test.ts (3 tests) 41ms
 ✓ apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts (4 tests) 18ms
 ✓ apps/brain-service/tests/content-summarizer/build-source-text.test.ts (1 test) 18ms
 ✓ packages/corpus/src/workspace-paths.test.ts (3 tests) 24ms
 ✓ packages/infra/src/cache/keys.test.ts (2 tests) 26ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts (4 tests) 75ms
 ✓ apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts (1 test) 21ms
 ✓ apps/brain-service/tests/user-memory-extract/legalize.test.ts (2 tests) 98ms
 ✓ apps/brain-service/tests/tools/translate-lang.test.ts (4 tests) 18ms
 ✓ packages/corpus/src/bm25.test.ts (2 tests) 15ms
 ✓ apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts (5 tests) 495ms
 ✓ apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts (12 tests) 451ms
 ✓ apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts (8 tests) 122ms
 ✓ apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts (7 tests) 373ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts (5 tests) 48ms
 ✓ apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts (6 tests) 34ms
 ✓ apps/brain-service/tests/execution/slot-subgraph-shell.test.ts (2 tests) 414ms
   ✓ slot subgraph shell (phase 3) > compiles km-slot and tool-slot subgraphs  351ms
 ✓ apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts (2 tests) 28ms
 ✓ apps/brain-service/tests/hitl-write/path-plan-corpus-edit.test.ts (1 test) 19ms
 ✓ apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts (4 tests) 20ms
 ✓ apps/brain-service/tests/corpus-lister/pure-list-route.test.ts (2 tests) 18ms
 ✓ apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts (4 tests) 11ms
 ✓ apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts (2 tests) 20ms
 ✓ apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts (4 tests) 16ms
 ✓ apps/brain-service/tests/pipeline/routes-after-organizer.test.ts (2 tests) 8ms
 ✓ apps/brain-service/tests/content-summarizer/summarize-route.test.ts (2 tests) 5ms

 Test Files  42 passed (42)
      Tests  171 passed (171)
   Start at  18:32:46
   Duration  59.63s (transform 16.30s, setup 0ms, collect 658.26s, tests 4.22s, environment 53ms, prepare 42.84s)

JSON report written to /Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/reports/vitest-raw.json

```

<!-- GATE-SECTION:eval -->

# Eval（Golden / Probe）

- **结果**: FAIL
- **生成时间**: 2026-08-10T10:38:45.615Z

# Eval 报告

- 时间：2026-08-10T10:38:45.611Z
- corpusUserId：cmp9ihokn00000mbmhwh6gn0b
- Chroma：在线

## 指标（4 项 MVP）

| 指标 | 值 |
|------|-----|
| Golden 通过率 | **26/27** (96.3%) |
| candidates>0 但 hits=0 | **0/7** (0.0%) |
| cache 命中率 | 0/1 (0.0%) |
| 端到端 latency p95 | **11574ms** (avg 4850ms) |

> cache：检索 cache 尚未接入 pipeline（指标占位 0/N）

## 用例

| ID | 层 | 结果 | latency | 说明 |
|----|-----|------|---------|------|
| G1 | pipeline | ✅ | 5808ms | ok |
| G2 | pipeline | ✅ | 7320ms | ok |
| G2b | pipeline | ✅ | 5369ms | ok |
| G2c | pipeline | ✅ | 6269ms | ok |
| G3 | pipeline | ✅ | 6706ms | ok |
| G4 | pipeline | ✅ | 5939ms | ok |
| G5 | pipeline | ✅ | 6001ms | ok |
| G5b | pipeline | ❌ | 6344ms | 缺少 step（任一即可）: km_retrieve \| list_retrieve \| plan_slot_join \| plan_merge \| retrieval \| plan_executor; answer 未匹配 /城管\|城市管理\|React\|UniApp\|TypeScript\|Vite/; answer 不应匹配 /哪\|哪个\|请说明\|指的是\|哪一段\|哪一家\|什么项目\|能否说明/ |
| G5c | pipeline | ✅ | 8026ms | ok |
| K1 | km | ✅ | 175ms | ok (hybrid, candidates=12) |
| K2 | km | ✅ | 170ms | ok (hybrid, candidates=12) |
| K2b | km | ✅ | 139ms | ok (hybrid, candidates=12) |
| K-family-brother | km | ✅ | 156ms | ok (hybrid, candidates=12) |
| K-family-sil | km | ✅ | 119ms | ok (hybrid, candidates=12) |
| L3 | list | ✅ | 1ms | ok (list_corpus, total=5, hits=5) |
| K4 | km | ✅ | 173ms | ok (hybrid, candidates=16) |
| K5 | km | ✅ | 121ms | ok (hybrid, candidates=12) |
| E2E-identity | pipeline | ✅ | 4439ms | ok |
| E2E-age | pipeline | ✅ | 4384ms | ok |
| E2E-phone | pipeline | ✅ | 3861ms | ok |
| E2E-brother | pipeline | ✅ | 3808ms | ok |
| E2E-sister-in-law | pipeline | ✅ | 4263ms | ok（retry） |
| E2E-family-tri | pipeline | ✅ | 8221ms | ok |
| E2E-enumeration | pipeline | ✅ | 9966ms | ok |
| E2E-dual-list | pipeline | ✅ | 5902ms | ok |
| E2E-five-composite | pipeline | ✅ | 15695ms | ok |
| E2E-six-composite-qq-phone | pipeline | ✅ | 11574ms | ok（retry） |

## Cache 探测

- CACHE-G4-repeat-t1: ✅ ok (5196ms)
- CACHE-G4-repeat-t2: ✅ ok（cache 探测：miss，cache 未接入） (5084ms)

## Mem 探测（GMem / P0-16）

- GMem-t1: ✅ ok (4066ms)
- GMem-t2: ✅ ok (3283ms)

## Profile 探测（R6-3）

- G-履历综合-t1: ❌ answer 缺少「云联智慧」; answer 缺少「友谊时光」; answer 缺少「奖多多」 (8355ms)
- G-履历综合-t2: ❌ answer 缺少「云联智慧」; answer 缺少「友谊时光」; answer 缺少「奖多多」 (10ms)
- G-履历综合-t3: ✅ ok (7838ms)
- G-履历综合-t4: ✅ ok (13859ms)

## 列举分页探测

- E2E-list-pagination-t1: ✅ ok (378ms)
- E2E-list-pagination-t2: ✅ ok (371ms)

## 双槽列举续页探测

- E2E-dual-list-pagination-t1: ✅ ok (4467ms)
- E2E-dual-list-pagination-t2: ✅ ok (895ms)

## 五连问探测

- E2E-five-composite-probe-t1: ✅ ok (4242ms)
- E2E-five-composite-probe-t2: ✅ ok (8050ms)

## 六连问 QQ+手机探测

- E2E-six-composite-qq-phone-probe-t1: ✅ ok (7802ms)
- E2E-six-composite-qq-phone-probe-t2: ✅ ok (13004ms)

## 个人档案 / 亲友探测

- G-个人档案-亲友-t1: ✅ ok (4963ms)
- G-个人档案-亲友-t2: ❌ answer 未匹配 /乔乔|乔/; answer 缺少「潘小强」 (10262ms)

## vault_workspace 探测

- V-list-pathplan: ✅ pathPlan list ok (0ms)
- V-ui-prompts: ✅ ui prompts ok (0ms)
- V-ui-crud-prompts: ✅ ui crud prompts ok (0ms)
- V-corpus-edit-dropped: ✅ corpus_edit legalize-dropped (0ms)
- V-crud-materialize: ✅ crud+materialize+purge ok (82ms)
- V-nested-folder: ✅ nested path ok (12ms)
- V-update-body: ✅ update+rematerialize ok (12ms)
- V-pipeline-list: ✅ pipeline list ok (原文库「(根目录)」共 3 项： 📁 folder-msn0uoti/ 📁 folder-msn0yygd/ 📄 untitled-msn0zaqx.tx) (903ms)

## 失败明细

- G5b: 缺少 step（任一即可）: km_retrieve | list_retrieve | plan_slot_join | plan_merge | retrieval | plan_executor; answer 未匹配 /城管|城市管理|React|UniApp|TypeScript|Vite/; answer 不应匹配 /哪|哪个|请说明|指的是|哪一段|哪一家|什么项目|能否说明/
- G-履历综合-t1: answer 缺少「云联智慧」; answer 缺少「友谊时光」; answer 缺少「奖多多」
- G-履历综合-t2: answer 缺少「云联智慧」; answer 缺少「友谊时光」; answer 缺少「奖多多」
- G-个人档案-亲友-t2: answer 未匹配 /乔乔|乔/; answer 缺少「潘小强」

<!-- GATE-SECTION:load -->

# 压测（Load）

- **结果**: PASS
- **生成时间**: 2026-08-10T10:39:29.900Z

### 覆盖说明

- **health**：brain `/health` 并发
- **corpus queue**：materialize/purge 消化
- **chat**：Web 登录 → 会话 → `/messages` SSE（对话全链路）

### 参数

| 项 | 值 |
|---|---|
| brain base | `http://127.0.0.1:3001` |
| health concurrency | 20 |
| health requests | 200 |
| corpusJobs | 80 |
| corpusUserId | `cmp9ihokn00000mbmhwh6gn0b` |
| queue enabled | true |
| chat skipped | false |
| chat base | `http://127.0.0.1:3000` |
| chat concurrency | 3 |
| chat requests | 10 |
| chat question | "我的名字是什么？" |
| chat strict pattern | false |

### Health 并发

| 指标 | 值 |
|---|---|
| n | 200 |
| errors | 0 |
| errorRate | 0.00% |
| avgMs | 29.23 |
| p50Ms | 12 |
| p95Ms | 143 |
| p99Ms | 167 |
| maxMs | 173 |

### Corpus Queue

| 指标 | 值 |
|---|---|
| materializeJobs | 80 |
| digestMs | 6096 |
| peakBacklog | 80 |
| materialize final | `{"waiting":0,"active":0,"delayed":0,"failed":0}` |
| purge final | `{"waiting":0,"active":0,"delayed":0,"failed":0}` |
| queueFailed | 0 |

### 对话全链路

| 指标 | 值 |
|---|---|
| n | 10 |
| errors | 0 |
| emptyAnswers | 0 |
| patternMiss | 0 |
| chatErrorRate | 0.00% |
| avgMs | 8928.6 |
| p50Ms | 8615 |
| p95Ms | 11196 |
| p99Ms | 11196 |
| maxMs | 11196 |

### 判定

- health errorRate ≤ 5%: OK
- queue failed = 0（若启用）: OK
- chat error+empty ≤ 15%（若未跳过）: OK
- chat pattern（仅 STRICT）: OK

<!-- GATE-SECTION:e2e -->

# E2E（API + Inprocess + Playwright）

- **结果**: PASS
- **生成时间**: 2026-08-10T10:40:26.714Z

### 覆盖说明

- **vault**：原文库 CRUD 冒烟（inprocess / API / Playwright）
- **对话主链**：Web 登录 → 会话 → 多轮问答 → brain pipeline（API + Playwright）

### 步骤总览

| 步骤 | 结果 | exit | 耗时 |
|---|---|---:|---:|
| Inprocess vault list（pipeline 旁路） | PASS | 0 | 12787ms |
| API E2E vault list/create/open/delete | PASS | 0 | 10167ms |
| API E2E 对话主链（姓名/年龄/手机） | PASS | 0 | 15032ms |
| Playwright（vault UI + 对话主链） | PASS | 0 | 17941ms |

### 环境

| 项 | 值 |
|---|---|
| E2E_BASE_URL | `http://127.0.0.1:3000` |
| E2E_USER | `panzhanfei` |
| AUTH_COOKIE_SECURE | `0` |
| Playwright HTML | `reports/playwright/html` |

### 失败/日志尾部

#### Inprocess vault list（pipeline 旁路）

_通过_

#### API E2E vault list/create/open/delete

_通过_

#### API E2E 对话主链（姓名/年龄/手机）

_通过_

#### Playwright（vault UI + 对话主链）

_通过_
