# Eval 全量报表

- **结果**: FAIL
- **生成时间**: 2026-08-17T08:30:09.427Z

# Eval 报告

- 时间：2026-08-17T08:30:09.425Z
- corpusUserId：cmp9ihokn00000mbmhwh6gn0b
- Qdrant：在线

## 指标（4 项 MVP）

| 指标 | 值 |
|------|-----|
| Golden 通过率 | **26/27** (96.3%) |
| candidates>0 但 hits=0 | **0/7** (0.0%) |
| cache 命中率 | 1/1 (100.0%) |
| 端到端 latency p95 | **12465ms** (avg 4643ms) |
| Token（pipeline） | **avg 2988** / p95 4291（n=18） |

> cache：已命中 L1 同问短路或 L2 检索 hits cache

> Token 按节点（avg）：intake=2480 · analyst=480 · global_rebatch=28

## 用例

| ID | 层 | 结果 | latency | tokens | 说明 |
|----|-----|------|---------|--------|------|
| G1 | pipeline | ✅ | 1444ms | — | ok |
| G2 | pipeline | ✅ | 9232ms | 3024 | ok |
| G2b | pipeline | ✅ | 6388ms | 3026 | ok |
| G2c | pipeline | ✅ | 7462ms | 3026 | ok |
| G3 | pipeline | ✅ | 13495ms | 2779 | ok |
| G4 | pipeline | ✅ | 6920ms | 3320 | ok |
| G5 | pipeline | ✅ | 4951ms | 4226 | ok |
| G5b | pipeline | ❌ | 5557ms | 4291 | 缺少 step（任一即可）: km_retrieve \| list_retrieve \| plan_slot_join \| plan_merge \| retrieval \| plan_executor; answer 未匹配 /城管\|城市管理\|React\|UniApp\|TypeScript\|Vite/; answer 不应匹配 /哪\|哪个\|请说明\|指的是\|哪一段\|哪一家\|什么项目\|能否说明/ |
| G5c | pipeline | ✅ | 7886ms | 3108 | ok |
| K1 | km | ✅ | 85ms | — | ok (hybrid, candidates=9) |
| K2 | km | ✅ | 73ms | — | ok (hybrid, candidates=9) |
| K2b | km | ✅ | 76ms | — | ok (hybrid, candidates=9) |
| K-family-brother | km | ✅ | 98ms | — | ok (hybrid, candidates=12) |
| K-family-sil | km | ✅ | 73ms | — | ok (hybrid, candidates=12) |
| L3 | list | ✅ | 3ms | — | ok (list_corpus, total=5, hits=5) |
| K4 | km | ✅ | 78ms | — | ok (hybrid, candidates=16) |
| K5 | km | ✅ | 71ms | — | ok (hybrid, candidates=12) |
| E2E-identity | pipeline | ✅ | 4722ms | 3026 | ok |
| E2E-age | pipeline | ✅ | 3306ms | 2196 | ok |
| E2E-phone | pipeline | ✅ | 3959ms | 3034 | ok |
| E2E-brother | pipeline | ✅ | 3915ms | 2603 | ok（retry） |
| E2E-sister-in-law | pipeline | ✅ | 4056ms | 2616 | ok |
| E2E-family-tri | pipeline | ✅ | 8036ms | 4037 | ok |
| E2E-enumeration | pipeline | ✅ | 4769ms | 2194 | ok |
| E2E-dual-list | pipeline | ✅ | 5393ms | 2290 | ok |
| E2E-five-composite | pipeline | ✅ | 10841ms | 2461 | ok |
| E2E-six-composite-qq-phone | pipeline | ✅ | 12465ms | 2533 | ok（retry） |

## Cache 探测

- CACHE-G4-repeat-t1: ✅ ok (4544ms · 3232 tok)
- CACHE-G4-repeat-t2: ✅ ok（L1 同问短路） (13ms)

## Mem 探测（GMem / P0-16）

- GMem-t1: ✅ ok (8766ms · 4327 tok)
- GMem-t2: ✅ ok (3832ms · 2216 tok)

## Profile 探测（R6-3）

- G-履历综合-t1: ✅ ok (16460ms · 2916 tok)
- G-履历综合-t2: ✅ ok（同问短路：hit） (16ms)
- G-履历综合-t3: ✅ ok (4548ms · 2191 tok)
- G-履历综合-t4: ✅ ok (4770ms · 2305 tok)

## 列举分页探测

- E2E-list-pagination-t1: ✅ ok (1906ms)
- E2E-list-pagination-t2: ✅ ok (390ms)

## 双槽列举续页探测

- E2E-dual-list-pagination-t1: ✅ ok (3818ms · 2237 tok)
- E2E-dual-list-pagination-t2: ✅ ok (392ms)

## 五连问探测

- E2E-five-composite-probe-t1: ✅ ok (9915ms · 2300 tok)
- E2E-five-composite-probe-t2: ✅ ok (8086ms · 2434 tok)

## 六连问 QQ+手机探测

- E2E-six-composite-qq-phone-probe-t1: ✅ ok (6220ms · 4264 tok)
- E2E-six-composite-qq-phone-probe-t2: ✅ ok (16749ms · 3062 tok)

## 个人档案 / 亲友探测

- G-个人档案-亲友-t1: ✅ ok (6052ms · 3027 tok)
- G-个人档案-亲友-t2: ✅ ok (7761ms · 4021 tok)

## vault_workspace 探测

- V-list-pathplan: ✅ pathPlan list ok (0ms)
- V-ui-prompts: ✅ ui prompts ok (0ms)
- V-ui-crud-prompts: ✅ ui crud prompts ok (0ms)
- V-crud-materialize: ✅ crud+materialize+purge ok (15ms)
- V-nested-folder: ✅ nested path ok (9ms)
- V-update-body: ✅ update+rematerialize ok (10ms)
- V-pipeline-list: ✅ pipeline list pause ok (原文库「(根目录)」共 22 项： 📁 folder-msn0uoti/ 📁 folder-msn0yygd/ 📁 folder-msn3nuo6/ 📁) (3530ms)

## 匹配结构化探测（MatchReport）

- G-匹配结构化: ✅ ok (3ms)

## 失败明细

- G5b: 缺少 step（任一即可）: km_retrieve | list_retrieve | plan_slot_join | plan_merge | retrieval | plan_executor; answer 未匹配 /城管|城市管理|React|UniApp|TypeScript|Vite/; answer 不应匹配 /哪|哪个|请说明|指的是|哪一段|哪一家|什么项目|能否说明/
