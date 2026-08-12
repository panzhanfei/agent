# Eval 全量报表

- **结果**: FAIL
- **生成时间**: 2026-08-12T13:57:38.954Z

# Eval 报告

- 时间：2026-08-12T13:57:38.936Z
- corpusUserId：cmp9ihokn00000mbmhwh6gn0b
- Chroma：在线

## 指标（4 项 MVP）

| 指标 | 值 |
|------|-----|
| Golden 通过率 | **26/27** (96.3%) |
| candidates>0 但 hits=0 | **0/7** (0.0%) |
| cache 命中率 | 0/1 (0.0%) |
| 端到端 latency p95 | **13120ms** (avg 5294ms) |
| Token（pipeline） | **avg 3586** / p95 7797（n=18） |

> cache：检索 cache 尚未接入 pipeline（指标占位 0/N）

> Token 按节点（avg）：intake=2624 · analyst=962

## 用例

| ID | 层 | 结果 | latency | tokens | 说明 |
|----|-----|------|---------|--------|------|
| G1 | pipeline | ✅ | 3235ms | — | ok |
| G2 | pipeline | ✅ | 5419ms | 4080 | ok |
| G2b | pipeline | ✅ | 5260ms | 4082 | ok |
| G2c | pipeline | ✅ | 4901ms | 4081 | ok |
| G3 | pipeline | ✅ | 7219ms | 2294 | ok |
| G4 | pipeline | ✅ | 7826ms | 3816 | ok |
| G5 | pipeline | ✅ | 4589ms | 4231 | ok |
| G5b | pipeline | ❌ | 6026ms | 4250 | 缺少 step（任一即可）: km_retrieve \| list_retrieve \| plan_slot_join \| plan_merge \| retrieval \| plan_executor; answer 未匹配 /城管\|城市管理\|React\|UniApp\|TypeScript\|Vite/; answer 不应匹配 /哪\|哪个\|请说明\|指的是\|哪一段\|哪一家\|什么项目\|能否说明/ |
| G5c | pipeline | ✅ | 6858ms | 4140 | ok |
| K1 | km | ✅ | 558ms | — | ok (hybrid, candidates=12) |
| K2 | km | ✅ | 330ms | — | ok (hybrid, candidates=12) |
| K2b | km | ✅ | 242ms | — | ok (hybrid, candidates=12) |
| K-family-brother | km | ✅ | 198ms | — | ok (hybrid, candidates=12) |
| K-family-sil | km | ✅ | 207ms | — | ok (hybrid, candidates=12) |
| L3 | list | ✅ | 4ms | — | ok (list_corpus, total=5, hits=5) |
| K4 | km | ✅ | 193ms | — | ok (hybrid, candidates=16) |
| K5 | km | ✅ | 178ms | — | ok (hybrid, candidates=12) |
| E2E-identity | pipeline | ✅ | 7187ms | 4082 | ok |
| E2E-age | pipeline | ✅ | 3479ms | 2196 | ok |
| E2E-phone | pipeline | ✅ | 4675ms | 3837 | ok |
| E2E-brother | pipeline | ✅ | 6748ms | 2984 | ok |
| E2E-sister-in-law | pipeline | ✅ | 6498ms | 3142 | ok |
| E2E-family-tri | pipeline | ✅ | 19800ms | 7797 | ok |
| E2E-enumeration | pipeline | ✅ | 6716ms | 2245 | ok |
| E2E-dual-list | pipeline | ✅ | 8556ms | 2299 | ok |
| E2E-five-composite | pipeline | ✅ | 13120ms | 2461 | ok |
| E2E-six-composite-qq-phone | pipeline | ✅ | 12907ms | 2527 | ok |

## Cache 探测

- CACHE-G4-repeat-t1: ✅ ok (5836ms · 3607 tok)
- CACHE-G4-repeat-t2: ⚠️ answer 未匹配 /城管|城市管理平台|技术|React|TypeScript/ (7841ms · 3592 tok)

## Mem 探测（GMem / P0-16）

- GMem-t1: ✅ ok (5307ms · 2190 tok)
- GMem-t2: ✅ ok (3643ms · 2198 tok)

## Profile 探测（R6-3）

- G-履历综合-t1: ✅ ok (9832ms · 2428 tok)
- G-履历综合-t2: ✅ ok（同问短路：hit） (15ms)
- G-履历综合-t3: ✅ ok (4537ms · 2199 tok)
- G-履历综合-t4: ✅ ok (4703ms · 2297 tok)

## 列举分页探测

- E2E-list-pagination-t1: ✅ ok (2079ms)
- E2E-list-pagination-t2: ✅ ok (504ms)

## 双槽列举续页探测

- E2E-dual-list-pagination-t1: ✅ ok (4206ms · 2222 tok)
- E2E-dual-list-pagination-t2: ✅ ok (419ms)

## 五连问探测

- E2E-five-composite-probe-t1: ✅ ok (8349ms · 4314 tok)
- E2E-five-composite-probe-t2: ✅ ok (8620ms · 2450 tok)

## 六连问 QQ+手机探测

- E2E-six-composite-qq-phone-probe-t1: ✅ ok (8493ms · 2300 tok)
- E2E-six-composite-qq-phone-probe-t2: ✅ ok (17144ms · 4769 tok)

## 个人档案 / 亲友探测

- G-个人档案-亲友-t1: ✅ ok (6712ms · 4081 tok)
- G-个人档案-亲友-t2: ✅ ok (10222ms · 6108 tok)

## vault_workspace 探测

- V-list-pathplan: ✅ pathPlan list ok (1ms)
- V-ui-prompts: ✅ ui prompts ok (1ms)
- V-ui-crud-prompts: ✅ ui crud prompts ok (1ms)
- V-corpus-edit-dropped: ✅ corpus_edit legalize-dropped (0ms)
- V-crud-materialize: ✅ crud+materialize+purge ok (27ms)
- V-nested-folder: ✅ nested path ok (13ms)
- V-update-body: ✅ update+rematerialize ok (14ms)
- V-pipeline-list: ✅ pipeline list ok (原文库「(根目录)」共 14 项： 📁 folder-msn0uoti/ 📁 folder-msn0yygd/ 📁 folder-msn3nuo6/ 📁) (967ms)

## 匹配结构化探测（MatchReport）

- G-匹配结构化: ✅ ok (14ms)

## 失败明细

- G5b: 缺少 step（任一即可）: km_retrieve | list_retrieve | plan_slot_join | plan_merge | retrieval | plan_executor; answer 未匹配 /城管|城市管理|React|UniApp|TypeScript|Vite/; answer 不应匹配 /哪|哪个|请说明|指的是|哪一段|哪一家|什么项目|能否说明/
