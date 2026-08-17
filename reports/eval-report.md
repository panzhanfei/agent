# Eval 全量报表

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
