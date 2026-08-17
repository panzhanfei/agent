# FamBrain 工程门禁总报表

- **汇总状态**: FAIL
- **分项**: unit:PASS · eval:FAIL · load:PASS · e2e:FAIL
- **最后更新**: 2026-08-17T16:11:07.153Z
- **目录**: `reports/`
- **机器可读**: `reports/{unit,eval,load,e2e}-report.json`
- **写入策略**: 分项覆盖；GATE 按段覆盖合并（非历史累加）

> 分层门禁：unit / eval / load / e2e。Load 含 health+队列+对话全链路；E2E 含 vault 与对话主链。

<!-- GATE-SECTION:unit -->

# 单元测试

- **结果**: PASS
- **生成时间**: 2026-08-12T13:42:16.124Z

### 汇总

| 指标 | 值 |
|---|---|
| exitCode | 0 |
| total | 185 |
| passed | 185 |
| failed | 0 |
| pending | 0 |
| elapsedMs | 55496 |

### 按文件

| 文件 | passed | failed | total |
|---|---:|---:|---:|
| `packages/auth/src/national-id.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/bm25.test.ts` | 2 | 0 | 2 |
| `packages/corpus/src/recall-tokenize.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/workspace-fs.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/workspace-paths.test.ts` | 3 | 0 | 3 |
| `packages/test-kit/src/check-dependency-tree.test.ts` | 3 | 0 | 3 |
| `packages/infra/src/cache/keys.test.ts` | 2 | 0 | 2 |
| `packages/db/src/repos/conversations-edit.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/execution/control-plane.test.ts` | 11 | 0 | 11 |
| `apps/brain-service/tests/execution/dag-partial-reexec.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/execution/empty-policy.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/execution/global-rebatch.test.ts` | 9 | 0 | 9 |
| `apps/brain-service/tests/execution/slot-subgraph-shell.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/content-summarizer/build-source-text.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/content-summarizer/summarize-route.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/corpus-lister/pure-list-route.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts` | 6 | 0 | 6 |
| `apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts` | 12 | 0 | 12 |
| `apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts` | 8 | 0 | 8 |
| `apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts` | 7 | 0 | 7 |
| `apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/hitl-write/compose-and-lifecycle.test.ts` | 7 | 0 | 7 |
| `apps/brain-service/tests/hitl-write/path-plan-corpus-edit.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/hitl-write/paths-and-actions.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/hitl-write/propose-abc.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tool-orchestrator/match-report.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tools/compute-age.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tools/compute-tenure.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/tools/external-link-query-regression.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tools/extract-tools.test.ts` | 11 | 0 | 11 |
| `apps/brain-service/tests/tools/translate-lang.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/pipeline/routes-after-organizer.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/user-memory-extract/legalize.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts` | 2 | 0 | 2 |

### 失败用例

_无_

### 终端尾部

```
ct/own/fambrain-agents

 ✓ packages/corpus/src/recall-tokenize.test.ts (3 tests) 13ms
 ✓ packages/test-kit/src/check-dependency-tree.test.ts (3 tests) 40ms
 ✓ packages/db/src/repos/conversations-edit.test.ts (4 tests) 626ms
   ✓ editRegenerateMessageBodySchema > accepts content and optional turnId  437ms
 ✓ apps/brain-service/tests/execution/control-plane.test.ts (11 tests) 62ms
 ✓ apps/brain-service/tests/tools/extract-tools.test.ts (11 tests) 60ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts (4 tests) 13ms
 ✓ packages/corpus/src/workspace-fs.test.ts (3 tests) 203ms
 ✓ apps/brain-service/tests/hitl-write/compose-and-lifecycle.test.ts (7 tests) 108ms
 ✓ apps/brain-service/tests/hitl-write/propose-abc.test.ts (5 tests) 30ms
 ✓ apps/brain-service/tests/execution/global-rebatch.test.ts (9 tests) 70ms
 ✓ apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts (3 tests) 58ms
 ✓ apps/brain-service/tests/tools/compute-age.test.ts (4 tests) 49ms
 ✓ apps/brain-service/tests/tools/translate-lang.test.ts (4 tests) 35ms
 ✓ apps/brain-service/tests/tool-orchestrator/match-report.test.ts (4 tests) 28ms
 ✓ apps/brain-service/tests/execution/dag-partial-reexec.test.ts (5 tests) 24ms
 ✓ apps/brain-service/tests/execution/empty-policy.test.ts (5 tests) 27ms
 ✓ apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts (6 tests) 22ms
 ✓ apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts (5 tests) 36ms
 ✓ apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts (7 tests) 39ms
 ✓ apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts (12 tests) 171ms
 ✓ apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts (8 tests) 43ms
 ✓ apps/brain-service/tests/execution/slot-subgraph-shell.test.ts (2 tests) 45ms
 ✓ apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts (2 tests) 18ms
 ✓ apps/brain-service/tests/tools/external-link-query-regression.test.ts (4 tests) 76ms
 ✓ packages/corpus/src/bm25.test.ts (2 tests) 16ms
 ✓ apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts (2 tests) 18ms
 ✓ apps/brain-service/tests/user-memory-extract/legalize.test.ts (2 tests) 49ms
 ✓ packages/infra/src/cache/keys.test.ts (2 tests) 19ms
 ✓ apps/brain-service/tests/hitl-write/paths-and-actions.test.ts (3 tests) 33ms
 ✓ apps/brain-service/tests/content-summarizer/build-source-text.test.ts (1 test) 18ms
 ✓ apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts (2 tests) 37ms
 ✓ packages/auth/src/national-id.test.ts (3 tests) 20ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts (5 tests) 19ms
 ✓ apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts (1 test) 23ms
 ✓ apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts (4 tests) 28ms
 ✓ packages/corpus/src/workspace-paths.test.ts (3 tests) 37ms
 ✓ apps/brain-service/tests/tools/compute-tenure.test.ts (3 tests) 20ms
 ✓ apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts (4 tests) 19ms
 ✓ apps/brain-service/tests/corpus-lister/pure-list-route.test.ts (2 tests) 20ms
 ✓ apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts (4 tests) 62ms
 ✓ apps/brain-service/tests/hitl-write/path-plan-corpus-edit.test.ts (1 test) 76ms
 ✓ apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts (2 tests) 26ms
 ✓ apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts (4 tests) 15ms
 ✓ apps/brain-service/tests/content-summarizer/summarize-route.test.ts (2 tests) 11ms
 ✓ apps/brain-service/tests/pipeline/routes-after-organizer.test.ts (2 tests) 10ms

 Test Files  45 passed (45)
      Tests  185 passed (185)
   Start at  21:41:22
   Duration  53.25s (transform 15.01s, setup 0ms, collect 571.62s, tests 2.47s, environment 52ms, prepare 41.08s)

JSON report written to /Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/reports/vitest-raw.json

```

<!-- GATE-SECTION:eval -->

# Eval（Golden / Probe）

- **结果**: FAIL
- **生成时间**: 2026-08-17T16:11:07.153Z

# Eval 报告

- 时间：2026-08-17T16:11:07.150Z
- corpusUserId：cmp9ihokn00000mbmhwh6gn0b
- Qdrant：在线

## 指标（4 项 MVP）

| 指标 | 值 |
|------|-----|
| Golden 通过率 | **23/27** (85.2%) |
| candidates>0 但 hits=0 | **0/7** (0.0%) |
| cache 命中率 | 1/1 (100.0%) |
| 端到端 latency p95 | **13087ms** (avg 4944ms) |
| Token（pipeline） | **avg 3145** / p95 5860（n=18） |

> cache：已命中 L1 同问短路或 L2 检索 hits cache

> Token 按节点（avg）：intake=2611 · analyst=496 · global_rebatch=38

## 用例

| ID | 层 | 结果 | latency | tokens | 说明 |
|----|-----|------|---------|--------|------|
| G1 | pipeline | ✅ | 3746ms | — | ok |
| G2 | pipeline | ✅ | 7319ms | 3024 | ok |
| G2b | pipeline | ✅ | 6634ms | 3026 | ok |
| G2c | pipeline | ✅ | 6611ms | 3026 | ok |
| G3 | pipeline | ✅ | 6250ms | 2298 | ok |
| G4 | pipeline | ✅ | 6680ms | 3252 | ok |
| G5 | pipeline | ✅ | 5491ms | 4290 | ok |
| G5b | pipeline | ❌ | 5478ms | 4268 | 缺少 step（任一即可）: km_retrieve \| list_retrieve \| plan_slot_join \| plan_merge \| retrieval \| plan_executor; answer 未匹配 /城管\|城市管理\|React\|UniApp\|TypeScript\|Vite/; answer 不应匹配 /哪\|哪个\|请说明\|指的是\|哪一段\|哪一家\|什么项目\|能否说明/ |
| G5c | pipeline | ✅ | 6082ms | 3344 | ok（retry） |
| K1 | km | ✅ | 95ms | — | ok (hybrid, candidates=9) |
| K2 | km | ✅ | 104ms | — | ok (hybrid, candidates=9) |
| K2b | km | ✅ | 73ms | — | ok (hybrid, candidates=9) |
| K-family-brother | km | ✅ | 77ms | — | ok (hybrid, candidates=12) |
| K-family-sil | km | ✅ | 71ms | — | ok (hybrid, candidates=12) |
| L3 | list | ✅ | 10ms | — | ok (list_corpus, total=5, hits=5) |
| K4 | km | ✅ | 102ms | — | ok (hybrid, candidates=16) |
| K5 | km | ✅ | 75ms | — | ok (hybrid, candidates=12) |
| E2E-identity | pipeline | ✅ | 5325ms | 3026 | ok |
| E2E-age | pipeline | ✅ | 3282ms | 2195 | ok |
| E2E-phone | pipeline | ✅ | 3970ms | 3034 | ok |
| E2E-brother | pipeline | ❌ | 4074ms | 3048 | answer 未匹配 /潘小强/ |
| E2E-sister-in-law | pipeline | ✅ | 4194ms | 2612 | ok |
| E2E-family-tri | pipeline | ❌ | 15877ms | 3048 | answer 未匹配 /乔乔\|乔/; answer 缺少「潘小强」 |
| E2E-enumeration | pipeline | ✅ | 5931ms | 2201 | ok |
| E2E-dual-list | pipeline | ❌ | 13087ms | 5860 | 缺少 step: list_retrieve; 不应有 step: plan_merge |
| E2E-five-composite | pipeline | ✅ | 11908ms | 2461 | ok |
| E2E-six-composite-qq-phone | pipeline | ✅ | 10934ms | 2599 | ok |

## Cache 探测

- CACHE-G4-repeat-t1: ⚠️ 缺少 step（任一即可）: km_retrieve | list_retrieve | plan_slot_join | plan_merge | retrieval | plan_executor (4427ms · 2185 tok)
- CACHE-G4-repeat-t2: ✅ ok（L1 同问短路） (22ms)

## Mem 探测（GMem / P0-16）

- GMem-t1: ✅ ok (9539ms · 2293 tok)
- GMem-t2: ✅ ok (3577ms · 2202 tok)

## Profile 探测（R6-3）

- G-履历综合-t1: ✅ ok (8265ms · 2441 tok)
- G-履历综合-t2: ✅ ok（同问短路：hit） (20ms)
- G-履历综合-t3: ✅ ok (5457ms · 2199 tok)
- G-履历综合-t4: ✅ ok (4636ms · 2297 tok)

## 列举分页探测

- E2E-list-pagination-t1: ✅ ok (1903ms)
- E2E-list-pagination-t2: ✅ ok (392ms)

## 双槽列举续页探测

- E2E-dual-list-pagination-t1: ✅ ok (4475ms · 2262 tok)
- E2E-dual-list-pagination-t2: ✅ ok (2212ms)

## 五连问探测

- E2E-five-composite-probe-t1: ✅ ok (6408ms · 2272 tok)
- E2E-five-composite-probe-t2: ✅ ok (8107ms · 2431 tok)

## 六连问 QQ+手机探测

- E2E-six-composite-qq-phone-probe-t1: ✅ ok (12760ms · 4329 tok)
- E2E-six-composite-qq-phone-probe-t2: ✅ ok (15431ms · 4703 tok)

## 个人档案 / 亲友探测

- G-个人档案-亲友-t1: ✅ ok (4479ms · 3026 tok)
- G-个人档案-亲友-t2: ✅ ok (8846ms · 5092 tok)

## vault_workspace 探测

- V-list-pathplan: ✅ pathPlan list ok (1ms)
- V-ui-prompts: ✅ ui prompts ok (1ms)
- V-ui-crud-prompts: ✅ ui crud prompts ok (0ms)
- V-crud-materialize: ✅ crud+materialize+purge ok (32ms)
- V-nested-folder: ✅ nested path ok (13ms)
- V-update-body: ✅ update+rematerialize ok (13ms)
- V-pipeline-list: ✅ pipeline list pause ok (原文库「(根目录)」暂无文件或文件夹。可新建文件夹（自行分类）或新建 txt。) (2971ms)
- V-save-gate-sanitize: ✅ save-gate sanitize/resume ok (0ms)
- V-save-gate-offer: ✅ offer rules ok (0ms)
- V-save-gate-prompts: ✅ save-gate prompts ok (1ms)

## 匹配结构化探测（MatchReport）

- G-匹配结构化: ✅ ok (7ms)

## 失败明细

- G5b: 缺少 step（任一即可）: km_retrieve | list_retrieve | plan_slot_join | plan_merge | retrieval | plan_executor; answer 未匹配 /城管|城市管理|React|UniApp|TypeScript|Vite/; answer 不应匹配 /哪|哪个|请说明|指的是|哪一段|哪一家|什么项目|能否说明/
- E2E-brother: answer 未匹配 /潘小强/
- E2E-family-tri: answer 未匹配 /乔乔|乔/; answer 缺少「潘小强」
- E2E-dual-list: 缺少 step: list_retrieve; 不应有 step: plan_merge

<!-- GATE-SECTION:load -->

# 压测（Load）

- **结果**: PASS
- **生成时间**: 2026-08-12T13:48:37.444Z

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
| avgMs | 64.34 |
| p50Ms | 21 |
| p95Ms | 296 |
| p99Ms | 337 |
| maxMs | 349 |

### Corpus Queue

| 指标 | 值 |
|---|---|
| materializeJobs | 80 |
| digestMs | 8106 |
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
| avgMs | 9003.6 |
| p50Ms | 8810 |
| p95Ms | 11177 |
| p99Ms | 11177 |
| maxMs | 11177 |

### 判定

- health errorRate ≤ 5%: OK
- queue failed = 0（若启用）: OK
- chat error+empty ≤ 15%（若未跳过）: OK
- chat pattern（仅 STRICT）: OK

<!-- GATE-SECTION:e2e -->

# E2E（API + Inprocess + Playwright）

- **结果**: FAIL
- **生成时间**: 2026-08-14T13:01:55.158Z

### 覆盖说明

- **vault**：原文库 CRUD 冒烟（inprocess / API / Playwright）
- **对话主链**：Web 登录 → 会话 → 多轮问答 → brain pipeline（API + Playwright）

### 步骤总览

| 步骤 | 结果 | exit | 耗时 |
|---|---|---:|---:|
| Inprocess vault list（pipeline 旁路） | PASS | 0 | 27938ms |
| API E2E vault list/create/open/delete | PASS | 0 | 14967ms |
| API E2E 对话主链（姓名/年龄/手机） | PASS | 0 | 20253ms |
| Playwright（vault UI + 对话主链） | FAIL | 1 | 107729ms |

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

```

Running 2 tests using 2 workers

(node:36977) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:36978) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:36977) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:36978) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  1 [chromium] › e2e/chat-chain.spec.ts:34:7 › chat dialogue chain › login → 姓名 → 年龄 → 手机（对话主链） (21.2s)
  ✘  2 [chromium] › e2e/vault-workspace.spec.ts:32:7 › vault workspace UI › login → list → 点击新建 txt → 删除 (1.7m)

  1) [chromium] › e2e/vault-workspace.spec.ts:32:7 › vault workspace UI › login → list → 点击新建 txt → 删除 

    Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeEnabled[2m([22m[2m)[22m failed

    Locator: getByRole('button', { name: /删除 .+\.txt/i, disabled: false }).last()
    Expected: enabled
    Timeout: 90000ms
    Error: element(s) not found

    Call log:
    [2m  - Expect "toBeEnabled" with timeout 90000ms[22m
    [2m  - waiting for getByRole('button', { name: /删除 .+\.txt/i, disabled: false }).last()[22m

      83 |       .getByRole("button", { name: /删除 .+\.txt/i, disabled: false })
      84 |       .last();
    > 85 |     await expect(deleteBtn).toBeEnabled({ timeout: 90_000 });
         |                             ^
      86 |     await deleteBtn.click();
      87 |     await expect(
      88 |       page.getByText(/已硬删除|Hard-deleted|入队硬删/i).first()
        at /Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/web/e2e/vault-workspace.spec.ts:85:29

    Error Context: ../../reports/playwright/test-results/vault-workspace-vault-work-151ca-ogin-→-list-→-点击新建-txt-→-删除-chromium/error-context.md

  1 failed
    [chromium] › e2e/vault-workspace.spec.ts:32:7 › vault workspace UI › login → list → 点击新建 txt → 删除 
  1 passed (1.7m)

```
