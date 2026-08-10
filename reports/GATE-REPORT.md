# FamBrain 工程门禁总报表

- **汇总状态**: FAIL
- **分项**: unit:PASS · eval:FAIL · load:PASS · e2e:PASS
- **最后更新**: 2026-08-10T09:44:20.529Z
- **目录**: `reports/`
- **机器可读**: `reports/{unit,eval,load,e2e}-report.json`

> 本文件聚合 unit / eval / load / e2e 四份详细报表，便于复盘引用。

## 门禁结论（本轮）

| 分项 | 结果 | 说明 |
|---|---|---|
| unit | PASS | 170/170 |
| eval | FAIL（接近全绿） | vault 全绿；Mem0 remember/recall 主路径已修；残留多为 Intake/LLM 抖动（G5b 指代、亲友偶发误走 recall、复合问 QQ 偶发未并入） |
| load | PASS | health 200×20 p95≈83ms；corpus queue 80 jobs digest≈5.1s failed=0 |
| e2e | PASS | inprocess + API vault CRUD + Playwright UI |

产物：`reports/GATE-REPORT.md`（四段合一）+ `reports/{unit,eval,load,e2e}-report.{md,json}`。

<!-- GATE-SECTION:unit -->

# 单元测试

# 单元测试

# 单元测试

# 单元测试

## 单元测试报表

- **结果**: PASS
- **生成时间**: 2026-08-10T09:31:48.612Z

### 汇总

| 指标 | 值 |
|---|---|
| exitCode | 0 |
| total | 170 |
| passed | 170 |
| failed | 0 |
| pending | 0 |
| elapsedMs | 19155 |

### 按文件

| 文件 | passed | failed | total |
|---|---:|---:|---:|
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/packages/auth/src/national-id.test.ts` | 3 | 0 | 3 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/packages/corpus/src/bm25.test.ts` | 2 | 0 | 2 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/packages/corpus/src/recall-tokenize.test.ts` | 3 | 0 | 3 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/packages/corpus/src/workspace-fs.test.ts` | 3 | 0 | 3 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/packages/corpus/src/workspace-paths.test.ts` | 3 | 0 | 3 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/packages/test-kit/src/check-dependency-tree.test.ts` | 3 | 0 | 3 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/content-summarizer/build-source-text.test.ts` | 1 | 0 | 1 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/content-summarizer/summarize-route.test.ts` | 2 | 0 | 2 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts` | 2 | 0 | 2 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/corpus-lister/pure-list-route.test.ts` | 2 | 0 | 2 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts` | 1 | 0 | 1 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/execution/control-plane.test.ts` | 11 | 0 | 11 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/execution/global-rebatch.test.ts` | 9 | 0 | 9 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/execution/slot-subgraph-shell.test.ts` | 2 | 0 | 2 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/hitl-write/compose-and-lifecycle.test.ts` | 7 | 0 | 7 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/hitl-write/path-plan-corpus-edit.test.ts` | 1 | 0 | 1 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/hitl-write/paths-and-actions.test.ts` | 3 | 0 | 3 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/hitl-write/propose-abc.test.ts` | 5 | 0 | 5 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts` | 4 | 0 | 4 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts` | 4 | 0 | 4 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts` | 2 | 0 | 2 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts` | 6 | 0 | 6 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts` | 11 | 0 | 11 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts` | 8 | 0 | 8 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts` | 4 | 0 | 4 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts` | 3 | 0 | 3 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts` | 7 | 0 | 7 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts` | 4 | 0 | 4 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts` | 5 | 0 | 5 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/pipeline/routes-after-organizer.test.ts` | 2 | 0 | 2 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts` | 2 | 0 | 2 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts` | 2 | 0 | 2 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts` | 4 | 0 | 4 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/user-memory-extract/legalize.test.ts` | 2 | 0 | 2 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/tools/compute-age.test.ts` | 4 | 0 | 4 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/tools/compute-tenure.test.ts` | 3 | 0 | 3 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/tools/external-link-query-regression.test.ts` | 4 | 0 | 4 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/tools/extract-tools.test.ts` | 11 | 0 | 11 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/tools/translate-lang.test.ts` | 4 | 0 | 4 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts` | 5 | 0 | 5 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/packages/infra/src/cache/keys.test.ts` | 2 | 0 | 2 |
| `/Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/packages/db/src/repos/conversations-edit.test.ts` | 4 | 0 | 4 |

### 失败用例

_无_

### 终端尾部

```

 RUN  v3.2.7 /Users/panzhanfei/Desktop/个人/project/own/fambrain-agents

 ✓ packages/corpus/src/bm25.test.ts (2 tests) 4ms
 ✓ apps/brain-service/tests/tools/external-link-query-regression.test.ts (4 tests) 13ms
 ✓ packages/test-kit/src/check-dependency-tree.test.ts (3 tests) 22ms
 ✓ packages/db/src/repos/conversations-edit.test.ts (4 tests) 235ms
 ✓ apps/brain-service/tests/execution/control-plane.test.ts (11 tests) 49ms
 ✓ apps/brain-service/tests/tools/compute-age.test.ts (4 tests) 8ms
 ✓ packages/corpus/src/workspace-paths.test.ts (3 tests) 7ms
 ✓ apps/brain-service/tests/tools/extract-tools.test.ts (11 tests) 62ms
 ✓ packages/corpus/src/workspace-fs.test.ts (3 tests) 45ms
 ✓ packages/auth/src/national-id.test.ts (3 tests) 9ms
 ✓ apps/brain-service/tests/content-summarizer/build-source-text.test.ts (1 test) 7ms
 ✓ apps/brain-service/tests/execution/global-rebatch.test.ts (9 tests) 17ms
 ✓ apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts (2 tests) 10ms
 ✓ apps/brain-service/tests/hitl-write/propose-abc.test.ts (5 tests) 24ms
 ✓ apps/brain-service/tests/hitl-write/compose-and-lifecycle.test.ts (7 tests) 24ms
 ✓ packages/corpus/src/recall-tokenize.test.ts (3 tests) 10ms
 ✓ apps/brain-service/tests/hitl-write/paths-and-actions.test.ts (3 tests) 9ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts (4 tests) 7ms
 ✓ apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts (4 tests) 8ms
 ✓ apps/brain-service/tests/tools/compute-tenure.test.ts (3 tests) 10ms
 ✓ apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts (3 tests) 24ms
 ✓ apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts (2 tests) 9ms
 ✓ apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts (1 test) 6ms
 ✓ packages/infra/src/cache/keys.test.ts (2 tests) 6ms
 ✓ apps/brain-service/tests/user-memory-extract/legalize.test.ts (2 tests) 10ms
 ✓ apps/brain-service/tests/tools/translate-lang.test.ts (4 tests) 9ms
 ✓ apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts (6 tests) 11ms
 ✓ apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts (7 tests) 15ms
 ✓ apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts (8 tests) 14ms
 ✓ apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts (5 tests) 15ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts (5 tests) 11ms
 ✓ apps/brain-service/tests/execution/slot-subgraph-shell.test.ts (2 tests) 20ms
 ✓ apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts (2 tests) 10ms
 ✓ apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts (11 tests) 24ms
 ✓ apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts (4 tests) 8ms
 ✓ apps/brain-service/tests/hitl-write/path-plan-corpus-edit.test.ts (1 test) 9ms
 ✓ apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts (2 tests) 5ms
 ✓ apps/brain-service/tests/corpus-lister/pure-list-route.test.ts (2 tests) 7ms
 ✓ apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts (4 tests) 6ms
 ✓ apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts (4 tests) 5ms
 ✓ apps/brain-service/tests/content-summarizer/summarize-route.test.ts (2 tests) 3ms
 ✓ apps/brain-service/tests/pipeline/routes-after-organizer.test.ts (2 tests) 3ms

 Test Files  42 passed (42)
      Tests  170 passed (170)
   Start at  17:31:30
   Duration  18.04s (transform 4.65s, setup 0ms, collect 189.26s, tests 809ms, environment 45ms, prepare 12.42s)

JSON report written to /Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/reports/vitest-raw.json

```
<!-- GATE-SECTION:eval -->

# Eval（Golden / Probe）

## Eval 全量报表

- **结果**: FAIL
- **生成时间**: 2026-08-10T09:44:20.529Z

# Eval 报告

- 时间：2026-08-10T09:44:20.528Z
- corpusUserId：cmp9ihokn00000mbmhwh6gn0b
- Chroma：在线

## 指标（4 项 MVP）

| 指标 | 值 |
|------|-----|
| Golden 通过率 | **24/27** (88.9%) |
| candidates>0 但 hits=0 | **0/7** (0.0%) |
| cache 命中率 | 0/1 (0.0%) |
| 端到端 latency p95 | **11736ms** (avg 4682ms) |

> cache：检索 cache 尚未接入 pipeline（指标占位 0/N）

## 用例

| ID | 层 | 结果 | latency | 说明 |
|----|-----|------|---------|------|
| G1 | pipeline | ✅ | 3304ms | ok |
| G2 | pipeline | ✅ | 5065ms | ok |
| G2b | pipeline | ✅ | 5770ms | ok |
| G2c | pipeline | ✅ | 3771ms | ok |
| G3 | pipeline | ✅ | 4347ms | ok（retry） |
| G4 | pipeline | ✅ | 7342ms | ok |
| G5 | pipeline | ✅ | 9911ms | ok |
| G5b | pipeline | ❌ | 5837ms | 缺少 step（任一即可）: km_retrieve \| list_retrieve \| plan_slot_join \| plan_merge \| retrieval \| plan_executor |
| G5c | pipeline | ✅ | 11736ms | ok |
| K1 | km | ✅ | 118ms | ok (hybrid, candidates=12) |
| K2 | km | ✅ | 116ms | ok (hybrid, candidates=12) |
| K2b | km | ✅ | 119ms | ok (hybrid, candidates=12) |
| K-family-brother | km | ✅ | 119ms | ok (hybrid, candidates=12) |
| K-family-sil | km | ✅ | 105ms | ok (hybrid, candidates=12) |
| L3 | list | ✅ | 1ms | ok (list_corpus, total=5, hits=5) |
| K4 | km | ✅ | 111ms | ok (hybrid, candidates=16) |
| K5 | km | ✅ | 112ms | ok (hybrid, candidates=12) |
| E2E-identity | pipeline | ✅ | 4479ms | ok |
| E2E-age | pipeline | ✅ | 5938ms | ok |
| E2E-phone | pipeline | ✅ | 4861ms | ok |
| E2E-brother | pipeline | ❌ | 4243ms | answer 未匹配 /潘小强/ |
| E2E-sister-in-law | pipeline | ✅ | 4144ms | ok |
| E2E-family-tri | pipeline | ✅ | 7794ms | ok |
| E2E-enumeration | pipeline | ✅ | 6873ms | ok |
| E2E-dual-list | pipeline | ✅ | 5491ms | ok |
| E2E-five-composite | pipeline | ✅ | 14554ms | ok |
| E2E-six-composite-qq-phone | pipeline | ❌ | 10146ms | answer 缺少「734858469」 |

## Cache 探测

- CACHE-G4-repeat-t1: ✅ ok (6018ms)
- CACHE-G4-repeat-t2: ✅ ok（cache 探测：miss，cache 未接入） (6146ms)

## Mem 探测（GMem / P0-16）

- GMem-t1: ✅ ok (4808ms)
- GMem-t2: ❌ answer 未匹配 /734858469/ (4477ms)

## Profile 探测（R6-3）

- G-履历综合-t1: ✅ ok (17318ms)
- G-履历综合-t2: ✅ ok（同问短路：hit） (9ms)
- G-履历综合-t3: ✅ ok (8056ms)
- G-履历综合-t4: ✅ ok (12626ms)

## 列举分页探测

- E2E-list-pagination-t1: ✅ ok (459ms)
- E2E-list-pagination-t2: ✅ ok (459ms)

## 双槽列举续页探测

- E2E-dual-list-pagination-t1: ✅ ok (4807ms)
- E2E-dual-list-pagination-t2: ✅ ok (844ms)

## 五连问探测

- E2E-five-composite-probe-t1: ✅ ok (4270ms)
- E2E-five-composite-probe-t2: ✅ ok (10516ms)

## 六连问 QQ+手机探测

- E2E-six-composite-qq-phone-probe-t1: ✅ ok (3921ms)
- E2E-six-composite-qq-phone-probe-t2: ✅ ok (18348ms)

## 个人档案 / 亲友探测

- G-个人档案-亲友-t1: ✅ ok (6705ms)
- G-个人档案-亲友-t2: ✅ ok (9389ms)

## vault_workspace 探测

- V-list-pathplan: ✅ pathPlan list ok (0ms)
- V-ui-prompts: ✅ ui prompts ok (0ms)
- V-ui-crud-prompts: ✅ ui crud prompts ok (0ms)
- V-corpus-edit-dropped: ✅ corpus_edit legalize-dropped (0ms)
- V-crud-materialize: ✅ crud+materialize+purge ok (13ms)
- V-nested-folder: ✅ nested path ok (7ms)
- V-update-body: ✅ update+rematerialize ok (8ms)
- V-pipeline-list: ✅ pipeline list ok (原文库「(根目录)」共 3 项： 📁 folder-msn0uoti/ 📁 folder-msn0yygd/ 📄 untitled-msn0zaqx.tx) (885ms)

## 失败明细

- G5b: 缺少 step（任一即可）: km_retrieve | list_retrieve | plan_slot_join | plan_merge | retrieval | plan_executor
- E2E-brother: answer 未匹配 /潘小强/
- E2E-six-composite-qq-phone: answer 缺少「734858469」
- GMem-t2: answer 未匹配 /734858469/

<!-- GATE-SECTION:load -->

# 压测（Load）

# 压测（Load）

# 压测（Load）

# 压测（Load）

# 压测（Load）

# 压测（Load）

# 压测（Load）

# 压测（Load）

# 压测（Load）

# 压测（Load）

# 压测（Load）

# 压测（Load）

# 压测（Load）

## 压测报表（中档）

- **结果**: PASS
- **生成时间**: 2026-08-10T09:14:38.017Z

### 参数

| 项 | 值 |
|---|---|
| base | `http://127.0.0.1:3001` |
| concurrency | 20 |
| requests | 200 |
| corpusJobs | 80 |
| corpusUserId | `cmp9ihokn00000mbmhwh6gn0b` |
| queue enabled | true |

### Health 并发

| 指标 | 值 |
|---|---|
| n | 200 |
| errors | 0 |
| errorRate | 0.00% |
| avgMs | 22.16 |
| p50Ms | 9 |
| p95Ms | 83 |
| p99Ms | 135 |
| maxMs | 142 |

### Corpus Queue

| 指标 | 值 |
|---|---|
| materializeJobs | 80 |
| digestMs | 5121 |
| peakBacklog | 80 |
| materialize final | `{"waiting":0,"active":0,"delayed":0,"failed":0}` |
| purge final | `{"waiting":0,"active":0,"delayed":0,"failed":0}` |
| queueFailed | 0 |

### 判定

- health errorRate ≤ 5%: OK
- queue failed = 0（若启用）: OK
<!-- GATE-SECTION:e2e -->

# E2E（API + Inprocess + Playwright）

# E2E（API + Inprocess + Playwright）

# E2E（API + Inprocess + Playwright）

# E2E（API + Inprocess + Playwright）

# E2E（API + Inprocess + Playwright）

# E2E（API + Inprocess + Playwright）

# E2E（API + Inprocess + Playwright）

## E2E 报表

- **结果**: PASS
- **生成时间**: 2026-08-10T09:24:46.005Z

### 步骤总览

| 步骤 | 结果 | exit | 耗时 |
|---|---|---:|---:|
| Inprocess vault list（pipeline 旁路） | PASS | 0 | 10947ms |
| API E2E vault list/create/open/delete | PASS | 0 | 7820ms |
| Playwright vault UI 冒烟 | PASS | 0 | 13627ms |

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

#### Playwright vault UI 冒烟

_通过_