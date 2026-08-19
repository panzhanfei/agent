# Eval 全量报表

- **结果**: FAIL
- **生成时间**: 2026-08-19T10:23:53.917Z

# Eval 报告

- 时间：2026-08-19T10:23:53.912Z
- corpusUserId：cmp9ihokn00000mbmhwh6gn0b
- Qdrant：在线

## 指标（4 项 MVP）

| 指标 | 值 |
|------|-----|
| Golden 通过率 | **25/29** (86.2%) |
| candidates>0 但 hits=0 | **0/8** (0.0%) |
| cache 命中率 | 1/1 (100.0%) |
| 端到端 latency p95 | **12509ms** (avg 4200ms) |
| Token（pipeline） | **avg 2814** / p95 4233（n=19） |

> cache：已命中 L1 同问短路或 L2 检索 hits cache

> Token 按节点（avg）：intake=2364 · analyst=423 · global_rebatch=27

## 用例

| ID | 层 | 结果 | latency | tokens | 说明 |
|----|-----|------|---------|--------|------|
| G1 | pipeline | ✅ | 1778ms | — | ok |
| G2 | pipeline | ✅ | 4814ms | 3024 | ok |
| G2b | pipeline | ✅ | 4426ms | 3027 | ok |
| G2c | pipeline | ✅ | 4424ms | 3025 | ok |
| G3 | pipeline | ✅ | 12576ms | 2785 | ok |
| G4 | pipeline | ❌ | 5043ms | 2213 | 缺少 step: content_organizer; 缺少 step: analyst; 缺少 step（任一即可）: km_retrieve \| list_retrieve \| plan_slot_join \| plan_merge \| retrieval \| plan_executor |
| G5 | pipeline | ✅ | 4194ms | 4233 | ok |
| G5b | pipeline | ❌ | 8700ms | 2389 | answer 未匹配 /城管\|城市管理\|React\|UniApp\|TypeScript\|Vite/ |
| G5c | pipeline | ✅ | 6381ms | 3155 | ok |
| K1 | km | ✅ | 84ms | — | ok (hybrid, candidates=9) |
| K2 | km | ✅ | 107ms | — | ok (hybrid, candidates=9) |
| K2b | km | ✅ | 101ms | — | ok (hybrid, candidates=9) |
| K-family-brother | km | ✅ | 94ms | — | ok (hybrid, candidates=12) |
| K-family-sil | km | ✅ | 87ms | — | ok (hybrid, candidates=12) |
| L3 | list | ✅ | 5ms | — | ok (list_corpus, total=5, hits=5) |
| K4 | km | ✅ | 83ms | — | ok (hybrid, candidates=16) |
| K5 | km | ❌ | 79ms | — | Top1 path 未匹配 /experience\|奥卡云/ |
| K-external-link | km | ✅ | 83ms | — | ok (hybrid, candidates=12) |
| E2E-external-link | pipeline | ✅ | 6167ms | 2228 | ok |
| E2E-identity | pipeline | ✅ | 5762ms | 3026 | ok |
| E2E-age | pipeline | ✅ | 3299ms | 2195 | ok |
| E2E-phone | pipeline | ✅ | 3959ms | 3034 | ok |
| E2E-brother | pipeline | ❌ | 3904ms | 3038 | answer 未匹配 /潘小强/ |
| E2E-sister-in-law | pipeline | ✅ | 4005ms | 2602 | ok（retry） |
| E2E-family-tri | pipeline | ✅ | 7271ms | 4009 | ok |
| E2E-enumeration | pipeline | ✅ | 5000ms | 2202 | ok |
| E2E-dual-list | pipeline | ✅ | 5436ms | 2293 | ok |
| E2E-five-composite | pipeline | ✅ | 11415ms | 2459 | ok |
| E2E-six-composite-qq-phone | pipeline | ✅ | 12509ms | 2532 | ok |

## Cache 探测

- CACHE-G4-repeat-t1: ✅ ok (4498ms · 3512 tok)
- CACHE-G4-repeat-t2: ✅ ok（L1 同问短路） (27ms)

## Mem 探测（GMem / P0-16）

- GMem-t1: ✅ ok (9023ms · 4339 tok)
- GMem-t2: ✅ ok (3341ms · 2188 tok)

## Profile 探测（R6-3）

- G-履历综合-t1: ✅ ok (21897ms · 5034 tok)
- G-履历综合-t2: ✅ ok（同问短路：hit） (20ms)
- G-履历综合-t3: ✅ ok (4448ms · 2201 tok)
- G-履历综合-t4: ✅ ok (4589ms · 2298 tok)

## 列举分页探测

- E2E-list-pagination-t1: ✅ ok (1653ms)
- E2E-list-pagination-t2: ✅ ok (386ms)

## 双槽列举续页探测

- E2E-dual-list-pagination-t1: ✅ ok (4712ms · 2277 tok)
- E2E-dual-list-pagination-t2: ✅ ok (873ms)

## 五连问探测

- E2E-five-composite-probe-t1: ✅ ok (9451ms · 4341 tok)
- E2E-five-composite-probe-t2: ✅ ok (8310ms · 2433 tok)

## 六连问 QQ+手机探测

- E2E-six-composite-qq-phone-probe-t1: ✅ ok (4643ms · 2166 tok)
- E2E-six-composite-qq-phone-probe-t2: ✅ ok (16869ms · 4769 tok)

## 个人档案 / 亲友探测

- G-个人档案-亲友-t1: ✅ ok (5432ms · 3027 tok)
- G-个人档案-亲友-t2: ✅ ok (7393ms · 4004 tok)

## vault_workspace 探测

- V-list-pathplan: ✅ pathPlan list ok (1ms)
- V-ui-prompts: ✅ ui prompts ok (0ms)
- V-ui-crud-prompts: ✅ ui crud prompts ok (0ms)
- V-crud-materialize: ✅ crud+materialize+purge ok (20ms)
- V-nested-folder: ✅ nested path ok (12ms)
- V-update-body: ✅ update+rematerialize ok (13ms)
- V-pipeline-list: ✅ file list pause ok jobId=cmszy1r500001yibmybvcckhf (原文库「(根目录)」共 1 项： 📁 folder-mszxi4zv/) (929ms)
- V-resume-requires-jobid: ✅ resume without jobId rejected (1ms)
- V-file-thread-independent: ✅ qa=fambrain:eval-file-thread-1787135020486:1 file0=fambrain-file:eval-file-thread-1787135020486:0 file1=fambrain-file:eval-file-thread-1787135020486:1 (3ms)
- V-save-gate-sanitize: ✅ save-gate sanitize/resume ok (0ms)
- V-save-gate-offer: ✅ offer rules ok (0ms)
- V-save-gate-prompts: ✅ save-gate prompts ok (0ms)
- V-qa-no-save-offer: ✅ qa/chitchat did not start file line (351ms)
- V-save-offer-attachments: ✅ save_offer + cancel ok jobId=cmszy1vww0004yibmx8wgtdao (5826ms)
- V-workspace-superseded-by-qa: ✅ workspace superseded by QA job=cmszy1x0s0006yibmuyab8ean (5843ms)
- V-save-offer-survives-qa: ✅ save_offer kept across QA job=cmszy20g30008yibm26p82mjb (1387ms)
- V-file-job-ttl: ✅ ttl expired job=cmszy21il000ayibmu9hgp5rg (14ms)

## 匹配结构化探测（MatchReport）

- G-匹配结构化: ✅ ok (4ms)

## 失败明细

- G4: 缺少 step: content_organizer; 缺少 step: analyst; 缺少 step（任一即可）: km_retrieve | list_retrieve | plan_slot_join | plan_merge | retrieval | plan_executor
- G5b: answer 未匹配 /城管|城市管理|React|UniApp|TypeScript|Vite/
- K5: Top1 path 未匹配 /experience|奥卡云/
- E2E-brother: answer 未匹配 /潘小强/
