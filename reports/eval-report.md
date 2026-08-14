# Eval 全量报表

- **结果**: FAIL
- **生成时间**: 2026-08-14T12:57:42.622Z

# Eval 报告

- 时间：2026-08-14T12:57:42.495Z
- corpusUserId：cmp9ihokn00000mbmhwh6gn0b
- Qdrant：在线

## 指标（4 项 MVP）

| 指标 | 值 |
|------|-----|
| Golden 通过率 | **25/27** (92.6%) |
| candidates>0 但 hits=0 | **0/7** (0.0%) |
| cache 命中率 | 1/1 (100.0%) |
| 端到端 latency p95 | **12978ms** (avg 4519ms) |
| Token（pipeline） | **avg 2966** / p95 5054（n=18） |

> cache：已命中 L1 同问短路或 L2 检索 hits cache

> Token 按节点（avg）：intake=2376 · analyst=590

## 用例

| ID | 层 | 结果 | latency | tokens | 说明 |
|----|-----|------|---------|--------|------|
| G1 | pipeline | ✅ | 3529ms | — | ok |
| G2 | pipeline | ✅ | 6770ms | 3024 | ok |
| G2b | pipeline | ✅ | 4896ms | 3027 | ok |
| G2c | pipeline | ✅ | 4899ms | 3025 | ok |
| G3 | pipeline | ✅ | 6905ms | 2268 | ok |
| G4 | pipeline | ✅ | 5350ms | 3359 | ok（retry） |
| G5 | pipeline | ✅ | 5374ms | 4277 | ok |
| G5b | pipeline | ❌ | 6984ms | 2382 | answer 未匹配 /城管\|城市管理\|React\|UniApp\|TypeScript\|Vite/ |
| G5c | pipeline | ✅ | 5612ms | 3133 | ok |
| K1 | km | ✅ | 97ms | — | ok (hybrid, candidates=9) |
| K2 | km | ✅ | 85ms | — | ok (hybrid, candidates=9) |
| K2b | km | ✅ | 87ms | — | ok (hybrid, candidates=9) |
| K-family-brother | km | ✅ | 79ms | — | ok (hybrid, candidates=12) |
| K-family-sil | km | ✅ | 82ms | — | ok (hybrid, candidates=12) |
| L3 | list | ✅ | 6ms | — | ok (list_corpus, total=5, hits=5) |
| K4 | km | ✅ | 81ms | — | ok (hybrid, candidates=16) |
| K5 | km | ✅ | 80ms | — | ok (hybrid, candidates=12) |
| E2E-identity | pipeline | ✅ | 5383ms | 3027 | ok |
| E2E-age | pipeline | ✅ | 3305ms | 2196 | ok |
| E2E-phone | pipeline | ✅ | 3973ms | 3034 | ok |
| E2E-brother | pipeline | ❌ | 4161ms | 3046 | answer 未匹配 /潘小强/ |
| E2E-sister-in-law | pipeline | ✅ | 4348ms | 3024 | ok |
| E2E-family-tri | pipeline | ✅ | 10119ms | 5054 | ok |
| E2E-enumeration | pipeline | ✅ | 6996ms | 2244 | ok |
| E2E-dual-list | pipeline | ✅ | 6802ms | 2255 | ok |
| E2E-five-composite | pipeline | ✅ | 13040ms | 2458 | ok |
| E2E-six-composite-qq-phone | pipeline | ✅ | 12978ms | 2551 | ok |

## Cache 探测

- CACHE-G4-repeat-t1: ⚠️ 缺少 step（任一即可）: km_retrieve | list_retrieve | plan_slot_join | plan_merge | retrieval | plan_executor (4333ms · 2181 tok)
- CACHE-G4-repeat-t2: ✅ ok（L1 同问短路） (14ms)

## Mem 探测（GMem / P0-16）

- GMem-t1: ✅ ok (9124ms · 2308 tok)
- GMem-t2: ✅ ok (3582ms · 2202 tok)

## Profile 探测（R6-3）

- G-履历综合-t1: ✅ ok (17740ms · 2951 tok)
- G-履历综合-t2: ✅ ok（同问短路：hit） (10ms)
- G-履历综合-t3: ✅ ok (7459ms · 2201 tok)
- G-履历综合-t4: ✅ ok (4704ms · 2299 tok)

## 列举分页探测

- E2E-list-pagination-t1: ✅ ok (1347ms)
- E2E-list-pagination-t2: ✅ ok (350ms)

## 双槽列举续页探测

- E2E-dual-list-pagination-t1: ✅ ok (5501ms · 2331 tok)
- E2E-dual-list-pagination-t2: ✅ ok (3668ms)

## 五连问探测

- E2E-five-composite-probe-t1: ✅ ok (8938ms · 4330 tok)
- E2E-five-composite-probe-t2: ✅ ok (7816ms · 2408 tok)

## 六连问 QQ+手机探测

- E2E-six-composite-qq-phone-probe-t1: ✅ ok (8604ms · 2309 tok)
- E2E-six-composite-qq-phone-probe-t2: ✅ ok (13440ms · 3033 tok)

## 个人档案 / 亲友探测

- G-个人档案-亲友-t1: ✅ ok (3806ms · 3026 tok)
- G-个人档案-亲友-t2: ✅ ok (8138ms · 5064 tok)

## vault_workspace 探测

- V-list-pathplan: ✅ pathPlan list ok (0ms)
- V-ui-prompts: ✅ ui prompts ok (0ms)
- V-ui-crud-prompts: ✅ ui crud prompts ok (0ms)
- V-crud-materialize: ✅ crud+materialize+purge ok (32ms)
- V-nested-folder: ✅ nested path ok (16ms)
- V-update-body: ✅ update+rematerialize ok (17ms)
- V-pipeline-list: ✅ pipeline list ok (原文库「(根目录)」共 20 项： 📁 folder-msn0uoti/ 📁 folder-msn0yygd/ 📁 folder-msn3nuo6/ 📁) (2420ms)

## 匹配结构化探测（MatchReport）

- G-匹配结构化: ✅ ok (17ms)

## 失败明细

- G5b: answer 未匹配 /城管|城市管理|React|UniApp|TypeScript|Vite/
- E2E-brother: answer 未匹配 /潘小强/
