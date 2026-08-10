# 压测报表（中档）

- **结果**: PASS
- **生成时间**: 2026-08-10T10:39:29.900Z

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
| avgMs | 29.23 |
| p50Ms | 12 |
| p95Ms | 143 |
| p99Ms | 167 |
| maxMs | 173 |

### Corpus Queue

| 指标 | 值 |
|---|---|
| materializeJobs | 80 |
| digestMs | 6096 |
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
| avgMs | 8928.6 |
| p50Ms | 8615 |
| p95Ms | 11196 |
| p99Ms | 11196 |
| maxMs | 11196 |

### 判定

- health errorRate ≤ 5%: OK
- queue failed = 0（若启用）: OK
- chat error+empty ≤ 15%（若未跳过）: OK
- chat pattern（仅 STRICT）: OK
