# Eval 全量报表

- **结果**: FAIL
- **生成时间**: 2026-08-19T16:26:49.406Z

# Eval 报告

- 时间：2026-08-19T16:26:49.401Z
- corpusUserId：cmp9ihokn00000mbmhwh6gn0b
- Qdrant：在线

## 指标（4 项 MVP）

| 指标 | 值 |
|------|-----|
| Golden 通过率 | **29/30** (96.7%) |
| candidates>0 但 hits=0 | **0/8** (0.0%) |
| cache 命中率 | 1/1 (100.0%) |
| 端到端 latency p95 | **11087ms** (avg 3691ms) |
| Token（pipeline） | **avg 14780** / p95 18194（n=20） |

> cache：已命中 L1 同问短路或 L2 检索 hits cache

> Token 按节点（avg）：intake=13287 · analyst=1493

## 用例

| ID | 层 | 结果 | latency | tokens | 说明 |
|----|-----|------|---------|--------|------|
| G1 | pipeline | ✅ | 8137ms | — | ok |
| G2 | pipeline | ✅ | 2407ms | 13245 | ok |
| G2b | pipeline | ✅ | 1881ms | 13180 | ok |
| G2c | pipeline | ✅ | 2255ms | 13245 | ok |
| G3 | pipeline | ✅ | 6131ms | 26796 | ok |
| G4 | pipeline | ✅ | 12694ms | 17448 | ok |
| G5 | pipeline | ✅ | 7413ms | 13126 | ok |
| G5b | pipeline | ✅ | 5127ms | 18194 | ok |
| G5c | pipeline | ✅ | 10717ms | 14290 | ok |
| K1 | km | ✅ | 139ms | — | ok (hybrid, candidates=9) |
| K2 | km | ✅ | 98ms | — | ok (hybrid, candidates=9) |
| K2b | km | ✅ | 105ms | — | ok (hybrid, candidates=9) |
| K-family-brother | km | ✅ | 114ms | — | ok (hybrid, candidates=12) |
| K-family-sil | km | ✅ | 106ms | — | ok (hybrid, candidates=12) |
| L3 | list | ✅ | 6ms | — | ok (list_corpus, total=5, hits=5) |
| K4 | km | ✅ | 135ms | — | ok (hybrid, candidates=16) |
| K5 | km | ❌ | 102ms | — | Top1 path 未匹配 /experience\|奥卡云/ |
| K-external-link | km | ✅ | 110ms | — | ok (hybrid, candidates=12) |
| E2E-external-link | pipeline | ✅ | 6741ms | 13220 | ok |
| E2E-identity | pipeline | ✅ | 1779ms | 13181 | ok |
| E2E-age | pipeline | ✅ | 2723ms | 13187 | ok |
| E2E-phone | pipeline | ✅ | 1830ms | 13186 | ok |
| E2E-brother | pipeline | ✅ | 3438ms | 15593 | ok |
| E2E-sister-in-law | pipeline | ✅ | 3178ms | 15587 | ok |
| E2E-family-tri | pipeline | ✅ | 5015ms | 14966 | ok |
| E2E-enumeration | pipeline | ✅ | 5346ms | 13265 | ok |
| E2E-dual-list | pipeline | ✅ | 2455ms | 13372 | ok |
| E2E-five-composite | pipeline | ✅ | 4486ms | 13484 | ok |
| E2E-six-composite-qq-phone | pipeline | ✅ | 4968ms | 13878 | ok |
| E2E-weather-tianshui | pipeline | ✅ | 11087ms | 13162 | ok |

## Cache 探测

- CACHE-G4-repeat-t1: ✅ ok (5839ms · 17503 tok)
- CACHE-G4-repeat-t2: ✅ ok（L1 同问短路） (18ms)

## Mem 探测（GMem / P0-16）

- GMem-t1: ✅ ok (4996ms · 13131 tok)
- GMem-t2: ✅ ok (1503ms · 13123 tok)

## Profile 探测（R6-3）

- G-履历综合-t1: ✅ ok (7219ms · 29310 tok)
- G-履历综合-t2: ✅ ok（同问短路：hit） (47ms)
- G-履历综合-t3: ✅ ok (3658ms · 14394 tok)
- G-履历综合-t4: ❌ pipeline error: OpenAI 兼容聊天未返回助手文本（https://api.deepseek.com/chat/completions，model=deepseek-v4-flash）; 缺少 step: analyst; 缺少 step（任一即可）: km_retrieve | list_retrieve | plan_slot_join | plan_merge | retrieval | plan_executor; answer 缺少「云联智慧」; answer 缺少「友谊时光」; answer 缺少「奖多多」; answer 缺少「奥卡云」 (1315ms)

## 列举分页探测

- E2E-list-pagination-t1: ✅ ok (510ms)
- E2E-list-pagination-t2: ✅ ok (439ms)

## 双槽列举续页探测

- E2E-dual-list-pagination-t1: ✅ ok (2865ms · 13372 tok)
- E2E-dual-list-pagination-t2: ✅ ok (452ms)

## 五连问探测

- E2E-five-composite-probe-t1: ✅ ok (2796ms · 13131 tok)
- E2E-five-composite-probe-t2: ✅ ok (3079ms · 13564 tok)

## 六连问 QQ+手机探测

- E2E-six-composite-qq-phone-probe-t1: ✅ ok (3024ms · 13131 tok)
- E2E-six-composite-qq-phone-probe-t2: ✅ ok (4724ms · 13975 tok)

## 个人档案 / 亲友探测

- G-个人档案-亲友-t1: ✅ ok (4078ms · 13180 tok)
- G-个人档案-亲友-t2: ✅ ok (4410ms · 14926 tok)

## vault_workspace 探测

- V-list-pathplan: ✅ pathPlan list ok (1ms)
- V-ui-prompts: ✅ ui prompts ok (0ms)
- V-ui-crud-prompts: ✅ ui crud prompts ok (0ms)
- V-crud-materialize: ✅ crud+materialize+purge ok (33ms)
- V-nested-folder: ✅ nested path ok (16ms)
- V-update-body: ✅ update+rematerialize ok (13ms)
- V-pipeline-list: ✅ file list pause ok jobId=cmt0b0m1h00018xbmkivh2jlp (原文库「(根目录)」共 44 项： 📁 folder-mszxi4zv/ 📁 folder-mszy3e6o/ 📁 folder-mszy3e80/ 📁) (5957ms)
- V-resume-requires-jobid: ✅ resume without jobId rejected (1ms)
- V-file-thread-independent: ✅ qa=fambrain:eval-file-thread-1787156802247:1 file0=fambrain-file:eval-file-thread-1787156802247:0 file1=fambrain-file:eval-file-thread-1787156802247:1 (4ms)
- V-save-gate-sanitize: ✅ save-gate sanitize/resume ok (1ms)
- V-save-gate-offer: ✅ offer rules ok (0ms)
- V-save-gate-prompts: ✅ save-gate prompts ok (0ms)
- V-qa-no-save-offer: ✅ qa/chitchat did not start file line (419ms)
- V-save-offer-attachments: ✅ save_offer + cancel ok jobId=cmt0b0pd200048xbm79pbn67g (3862ms)
- V-workspace-superseded-by-qa: ✅ workspace superseded by QA job=cmt0b0q8l00068xbmz3i168f4 (2416ms)
- V-save-offer-survives-qa: ✅ save_offer kept across QA job=cmt0b0r9900088xbmseh9w8pg (435ms)
- V-file-job-ttl: ✅ ttl expired job=cmt0b0rla000a8xbm5e1iwdva (17ms)

## 匹配结构化探测（MatchReport）

- G-匹配结构化: ✅ ok (3ms)

## 失败明细

- K5: Top1 path 未匹配 /experience|奥卡云/
- G-履历综合-t4: pipeline error: OpenAI 兼容聊天未返回助手文本（https://api.deepseek.com/chat/completions，model=deepseek-v4-flash）; 缺少 step: analyst; 缺少 step（任一即可）: km_retrieve | list_retrieve | plan_slot_join | plan_merge | retrieval | plan_executor; answer 缺少「云联智慧」; answer 缺少「友谊时光」; answer 缺少「奖多多」; answer 缺少「奥卡云」
