# Eval 全量报表

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
