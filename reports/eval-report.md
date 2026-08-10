# Eval 全量报表

Eval 全量报表

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
