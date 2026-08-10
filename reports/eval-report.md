# Eval 全量报表

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
