# FamBrain 工程门禁总报表

- **汇总状态**: FAIL
- **分项**: unit:PASS · eval:FAIL · load:FAIL · e2e:PASS
- **最后更新**: 2026-08-19T17:14:18.869Z
- **目录**: `reports/`
- **机器可读**: `reports/{unit,eval,load,e2e}-report.json`
- **写入策略**: 分项覆盖；GATE 按段覆盖合并（非历史累加）

> 分层门禁：unit / eval / load / e2e。Load 含 health+队列+对话全链路；E2E 含 vault 与对话主链。

<!-- GATE-SECTION:unit -->

# 单元测试

- **结果**: PASS
- **生成时间**: 2026-08-19T10:19:10.677Z

### 汇总

| 指标 | 值 |
|---|---|
| exitCode | 0 |
| total | 227 |
| passed | 227 |
| failed | 0 |
| pending | 0 |
| elapsedMs | 35510 |

### 按文件

| 文件 | passed | failed | total |
|---|---:|---:|---:|
| `packages/auth/src/national-id.test.ts` | 3 | 0 | 3 |
| `packages/test-kit/src/check-dependency-tree.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/corpus-lister/pure-list-route.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/content-summarizer/build-source-text.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/content-summarizer/summarize-route.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/execution/control-plane.test.ts` | 10 | 0 | 10 |
| `apps/brain-service/tests/execution/dag-partial-reexec.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/execution/empty-policy.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/execution/file-thread.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/execution/global-rebatch.test.ts` | 9 | 0 | 9 |
| `apps/brain-service/tests/execution/pipeline-graph-compile.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/execution/pipeline-pause-resume.test.ts` | 8 | 0 | 8 |
| `apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts` | 7 | 0 | 7 |
| `apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts` | 15 | 0 | 15 |
| `apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts` | 8 | 0 | 8 |
| `apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts` | 9 | 0 | 9 |
| `apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts` | 7 | 0 | 7 |
| `apps/brain-service/tests/knowledge-manager/recall-doc-kinds.test.ts` | 8 | 0 | 8 |
| `apps/brain-service/tests/server/pipeline-stream-schema.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/pipeline/orchestrate-resume.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/pipeline/routes-after-organizer.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/sideline-file/decide.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/tool-orchestrator/match-report.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/user-memory-extract/legalize.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/vault-save-gate/save-gate.test.ts` | 6 | 0 | 6 |
| `apps/brain-service/tests/tools/compute-age.test.ts` | 6 | 0 | 6 |
| `apps/brain-service/tests/tools/compute-tenure.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/tools/external-link-query-regression.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tools/extract-tools.test.ts` | 11 | 0 | 11 |
| `apps/brain-service/tests/tools/translate-lang.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/vault-write/action-lifecycle.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts` | 9 | 0 | 9 |
| `packages/corpus/src/paths/corpus-noise.test.ts` | 1 | 0 | 1 |
| `packages/corpus/src/vector/bm25.test.ts` | 2 | 0 | 2 |
| `packages/corpus/src/workspace/workspace-fs.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/workspace/workspace-paths.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/qdrant/qdrant-sparse.test.ts` | 2 | 0 | 2 |
| `packages/corpus/src/qdrant/recall-tokenize.test.ts` | 3 | 0 | 3 |
| `packages/infra/src/cache/keys.test.ts` | 2 | 0 | 2 |
| `packages/db/src/repos/conversations-edit.test.ts` | 4 | 0 | 4 |
| `packages/db/src/repos/conversations-keep-file-jobs.test.ts` | 1 | 0 | 1 |
| `packages/db/src/repos/file-jobs.test.ts` | 2 | 0 | 2 |
| `packages/corpus/src/vector/doc-kind/doc-kind.test.ts` | 6 | 0 | 6 |

### 失败用例

_无_

### 终端尾部

```
s) 64ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts (4 tests) 8ms
 ✓ apps/brain-service/tests/execution/control-plane.test.ts (10 tests) 58ms
 ✓ packages/corpus/src/qdrant/recall-tokenize.test.ts (3 tests) 19ms
 ✓ apps/brain-service/tests/tools/translate-lang.test.ts (4 tests) 9ms
 ✓ packages/test-kit/src/check-dependency-tree.test.ts (3 tests) 30ms
 ✓ apps/brain-service/tests/execution/global-rebatch.test.ts (9 tests) 18ms
 ✓ apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts (9 tests) 15ms
 ✓ apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts (15 tests) 26ms
 ✓ apps/brain-service/tests/execution/empty-policy.test.ts (5 tests) 12ms
 ✓ apps/brain-service/tests/tools/external-link-query-regression.test.ts (4 tests) 19ms
 ✓ apps/brain-service/tests/tools/extract-tools.test.ts (11 tests) 31ms
 ✓ apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts (9 tests) 28ms
 ✓ apps/brain-service/tests/tools/compute-tenure.test.ts (5 tests) 19ms
 ✓ apps/brain-service/tests/vault-save-gate/save-gate.test.ts (6 tests) 22ms
 ✓ apps/brain-service/tests/execution/pipeline-graph-compile.test.ts (1 test) 21ms
 ✓ apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts (2 tests) 8ms
 ✓ apps/brain-service/tests/execution/pipeline-pause-resume.test.ts (8 tests) 120ms
 ✓ apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts (3 tests) 26ms
 ✓ apps/brain-service/tests/tool-orchestrator/match-report.test.ts (4 tests) 26ms
 ✓ packages/corpus/src/vector/bm25.test.ts (2 tests) 7ms
 ✓ apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts (4 tests) 9ms
 ✓ packages/corpus/src/workspace/workspace-paths.test.ts (3 tests) 8ms
 ✓ apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts (7 tests) 12ms
 ✓ apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts (2 tests) 9ms
 ✓ apps/brain-service/tests/vault-write/action-lifecycle.test.ts (3 tests) 10ms
 ✓ packages/corpus/src/qdrant/qdrant-sparse.test.ts (2 tests) 17ms
 ✓ apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts (1 test) 7ms
 ✓ apps/brain-service/tests/execution/dag-partial-reexec.test.ts (5 tests) 13ms
 ✓ packages/corpus/src/paths/corpus-noise.test.ts (1 test) 6ms
 ✓ apps/brain-service/tests/knowledge-manager/recall-doc-kinds.test.ts (8 tests) 15ms
 ✓ apps/brain-service/tests/execution/file-thread.test.ts (1 test) 8ms
 ✓ packages/infra/src/cache/keys.test.ts (2 tests) 7ms
 ✓ apps/brain-service/tests/user-memory-extract/legalize.test.ts (2 tests) 14ms
 ✓ apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts (2 tests) 50ms
 ✓ apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts (8 tests) 82ms
 ✓ apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts (7 tests) 90ms
 ✓ apps/brain-service/tests/corpus-lister/pure-list-route.test.ts (2 tests) 23ms
 ✓ apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts (2 tests) 16ms
 ✓ apps/brain-service/tests/tools/compute-age.test.ts (6 tests) 16ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts (5 tests) 14ms
 ✓ apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts (5 tests) 14ms
 ✓ apps/brain-service/tests/pipeline/routes-after-organizer.test.ts (2 tests) 15ms
 ✓ apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts (4 tests) 15ms
 ✓ apps/brain-service/tests/sideline-file/decide.test.ts (2 tests) 8ms
 ✓ apps/brain-service/tests/content-summarizer/summarize-route.test.ts (2 tests) 17ms
 ✓ apps/brain-service/tests/pipeline/orchestrate-resume.test.ts (1 test) 8ms

 Test Files  54 passed (54)
      Tests  227 passed (227)
   Start at  18:18:36
   Duration  33.96s (transform 6.76s, setup 0ms, collect 388.87s, tests 1.52s, environment 22ms, prepare 18.21s)

JSON report written to /Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/reports/vitest-raw.json

```

<!-- GATE-SECTION:eval -->

# Eval（Golden / Probe）

- **结果**: FAIL
- **生成时间**: 2026-08-19T17:14:18.869Z

# Eval 报告

- 时间：2026-08-19T17:14:18.867Z
- corpusUserId：cmp9ihokn00000mbmhwh6gn0b
- Qdrant：在线

## 指标（4 项 MVP）

| 指标 | 值 |
|------|-----|
| Golden 通过率 | **30/30** (100.0%) |
| candidates>0 但 hits=0 | **0/8** (0.0%) |
| cache 命中率 | 1/1 (100.0%) |
| 端到端 latency p95 | **10888ms** (avg 3104ms) |
| Token（pipeline） | **avg 14797** / p95 18251（n=20） |

> cache：已命中 L1 同问短路或 L2 检索 hits cache

> Token 按节点（avg）：intake=13288 · analyst=1510

## 用例

| ID | 层 | 结果 | latency | tokens | 说明 |
|----|-----|------|---------|--------|------|
| G1 | pipeline | ✅ | 5178ms | — | ok |
| G2 | pipeline | ✅ | 2860ms | 13245 | ok |
| G2b | pipeline | ✅ | 2244ms | 13180 | ok |
| G2c | pipeline | ✅ | 2382ms | 13245 | ok |
| G3 | pipeline | ✅ | 5042ms | 26704 | ok |
| G4 | pipeline | ✅ | 10888ms | 17669 | ok |
| G5 | pipeline | ✅ | 2276ms | 13126 | ok |
| G5b | pipeline | ✅ | 5619ms | 18251 | ok |
| G5c | pipeline | ✅ | 6133ms | 14446 | ok |
| K1 | km | ✅ | 117ms | — | ok (hybrid, candidates=9) |
| K2 | km | ✅ | 105ms | — | ok (hybrid, candidates=9) |
| K2b | km | ✅ | 101ms | — | ok (hybrid, candidates=9) |
| K-family-brother | km | ✅ | 108ms | — | ok (hybrid, candidates=12) |
| K-family-sil | km | ✅ | 107ms | — | ok (hybrid, candidates=12) |
| L3 | list | ✅ | 3ms | — | ok (list_corpus, total=5, hits=5) |
| K4 | km | ✅ | 118ms | — | ok (hybrid, candidates=16) |
| K5 | km | ✅ | 173ms | — | ok (hybrid, candidates=12) |
| K-external-link | km | ✅ | 136ms | — | ok (hybrid, candidates=12) |
| E2E-external-link | pipeline | ✅ | 2251ms | 13220 | ok |
| E2E-identity | pipeline | ✅ | 2094ms | 13181 | ok |
| E2E-age | pipeline | ✅ | 2109ms | 13187 | ok |
| E2E-phone | pipeline | ✅ | 1904ms | 13186 | ok |
| E2E-brother | pipeline | ✅ | 3264ms | 15593 | ok |
| E2E-sister-in-law | pipeline | ✅ | 3325ms | 15587 | ok |
| E2E-family-tri | pipeline | ✅ | 4712ms | 14963 | ok |
| E2E-enumeration | pipeline | ✅ | 3627ms | 13265 | ok |
| E2E-dual-list | pipeline | ✅ | 2544ms | 13373 | ok |
| E2E-five-composite | pipeline | ✅ | 4253ms | 13484 | ok |
| E2E-six-composite-qq-phone | pipeline | ✅ | 5277ms | 13878 | ok |
| E2E-weather-tianshui | pipeline | ✅ | 14166ms | 13162 | ok |

## Cache 探测

- CACHE-G4-repeat-t1: ✅ ok (5528ms · 17497 tok)
- CACHE-G4-repeat-t2: ✅ ok（L1 同问短路） (16ms)

## Mem 探测（GMem / P0-16）

- GMem-t1: ✅ ok (5002ms · 13131 tok)
- GMem-t2: ✅ ok (1502ms · 13123 tok)

## Profile 探测（R6-3）

- G-履历综合-t1: ✅ ok (9390ms · 29162 tok)
- G-履历综合-t2: ✅ ok（同问短路：hit） (24ms)
- G-履历综合-t3: ✅ ok (4397ms · 14574 tok)
- G-履历综合-t4: ❌ pipeline error: OpenAI 兼容聊天未返回助手文本（https://api.deepseek.com/chat/completions，model=deepseek-v4-flash）; 缺少 step: analyst; 缺少 step（任一即可）: km_retrieve | list_retrieve | plan_slot_join | plan_merge | retrieval | plan_executor; answer 缺少「云联智慧」; answer 缺少「友谊时光」; answer 缺少「奖多多」; answer 缺少「奥卡云」 (1606ms)

## 列举分页探测

- E2E-list-pagination-t1: ✅ ok (443ms)
- E2E-list-pagination-t2: ✅ ok (399ms)

## 双槽列举续页探测

- E2E-dual-list-pagination-t1: ✅ ok (2474ms · 13373 tok)
- E2E-dual-list-pagination-t2: ✅ ok (405ms)

## 五连问探测

- E2E-five-composite-probe-t1: ✅ ok (2535ms · 13131 tok)
- E2E-five-composite-probe-t2: ✅ ok (2886ms · 13564 tok)

## 六连问 QQ+手机探测

- E2E-six-composite-qq-phone-probe-t1: ✅ ok (2601ms · 13131 tok)
- E2E-six-composite-qq-phone-probe-t2: ✅ ok (4907ms · 13975 tok)

## 个人档案 / 亲友探测

- G-个人档案-亲友-t1: ✅ ok (2672ms · 13180 tok)
- G-个人档案-亲友-t2: ✅ ok (3704ms · 14918 tok)

## vault_workspace 探测

- V-list-pathplan: ✅ pathPlan list ok (1ms)
- V-ui-prompts: ✅ ui prompts ok (0ms)
- V-ui-crud-prompts: ✅ ui crud prompts ok (0ms)
- V-crud-materialize: ✅ crud+materialize+purge ok (21ms)
- V-nested-folder: ✅ nested path ok (9ms)
- V-update-body: ✅ update+rematerialize ok (10ms)
- V-pipeline-list: ✅ file list pause ok jobId=cmt0cppd80001nkbm9zo62yoy (原文库「(根目录)」共 44 项： 📁 folder-mszxi4zv/ 📁 folder-mszy3e6o/ 📁 folder-mszy3e80/ 📁) (504ms)
- V-resume-requires-jobid: ✅ resume without jobId rejected (1ms)
- V-file-thread-independent: ✅ qa=fambrain:eval-file-thread-1787159652567:1 file0=fambrain-file:eval-file-thread-1787159652567:0 file1=fambrain-file:eval-file-thread-1787159652567:1 (4ms)
- V-save-gate-sanitize: ✅ save-gate sanitize/resume ok (1ms)
- V-save-gate-offer: ✅ offer rules ok (0ms)
- V-save-gate-prompts: ✅ save-gate prompts ok (0ms)
- V-qa-no-save-offer: ✅ qa/chitchat did not start file line (385ms)
- V-save-offer-attachments: ✅ save_offer + cancel ok jobId=cmt0cpsdh0004nkbmkjdzbhyd (3493ms)
- V-workspace-superseded-by-qa: ✅ workspace superseded by QA job=cmt0cpson0006nkbm04o9whtg (2010ms)
- V-save-offer-survives-qa: ✅ save_offer kept across QA job=cmt0cptya0008nkbmuyhhw7mv (391ms)
- V-file-job-ttl: ✅ ttl expired job=cmt0cpu93000ankbm7a2lo03u (14ms)

## 匹配结构化探测（MatchReport）

- G-匹配结构化: ✅ ok (5ms)

## 失败明细

- G-履历综合-t4: pipeline error: OpenAI 兼容聊天未返回助手文本（https://api.deepseek.com/chat/completions，model=deepseek-v4-flash）; 缺少 step: analyst; 缺少 step（任一即可）: km_retrieve | list_retrieve | plan_slot_join | plan_merge | retrieval | plan_executor; answer 缺少「云联智慧」; answer 缺少「友谊时光」; answer 缺少「奖多多」; answer 缺少「奥卡云」

<!-- GATE-SECTION:load -->

# 压测（Load）

- **结果**: FAIL
- **生成时间**: 2026-08-19T10:24:40.843Z

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
| avgMs | 28.3 |
| p50Ms | 15 |
| p95Ms | 103 |
| p99Ms | 122 |
| maxMs | 126 |

### Corpus Queue

| 指标 | 值 |
|---|---|
| materializeJobs | 80 |
| digestMs | 6088 |
| peakBacklog | 80 |
| materialize final | `{"waiting":0,"active":0,"delayed":0,"failed":2}` |
| purge final | `{"waiting":0,"active":0,"delayed":0,"failed":2}` |
| queueFailed | 4 |

### 对话全链路

| 指标 | 值 |
|---|---|
| n | 10 |
| errors | 0 |
| emptyAnswers | 0 |
| patternMiss | 0 |
| chatErrorRate | 0.00% |
| avgMs | 9131.6 |
| p50Ms | 9138 |
| p95Ms | 10745 |
| p99Ms | 10745 |
| maxMs | 10745 |

### 判定

- health errorRate ≤ 5%: OK
- queue failed = 0（若启用）: FAIL
- chat error+empty ≤ 15%（若未跳过）: OK
- chat pattern（仅 STRICT）: OK

<!-- GATE-SECTION:e2e -->

# E2E（API + Inprocess + Playwright）

- **结果**: PASS
- **生成时间**: 2026-08-19T10:44:03.318Z

### 覆盖说明

- **vault**：原文库 CRUD 冒烟（inprocess / API / Playwright）
- **对话主链**：Web 登录 → 会话 → 多轮问答 → brain pipeline（API + Playwright）
- **文件 HITL**：Resume 缺 jobId 400、新 QA 顶替 workspace、附件总结出闸 / 保留 save_offer / 取消（API + Playwright 弹窗）

### 步骤总览

| 步骤 | 结果 | exit | 耗时 |
|---|---|---:|---:|
| Inprocess vault list（pipeline 旁路） | PASS | 0 | 9750ms |
| API E2E vault list/create/open/delete | PASS | 0 | 2361ms |
| API E2E 对话主链（姓名/年龄/手机） | PASS | 0 | 20488ms |
| API E2E 文件 HITL（jobId / save_offer / 新 QA） | PASS | 0 | 23059ms |
| Playwright（vault UI + 对话主链） | PASS | 0 | 27972ms |

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

#### API E2E 文件 HITL（jobId / save_offer / 新 QA）

_通过_

#### Playwright（vault UI + 对话主链）

_通过_
