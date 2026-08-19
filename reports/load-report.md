# 压测报表（中档）

- **结果**: FAIL
- **生成时间**: 2026-08-19T10:24:40.843Z

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
| avgMs | 28.3 |
| p50Ms | 15 |
| p95Ms | 103 |
| p99Ms | 122 |
| maxMs | 126 |

### Corpus Queue

| 指标 | 值 |
|---|---|
| materializeJobs | 80 |
| digestMs | 6088 |
| peakBacklog | 80 |
| materialize final | `{"waiting":0,"active":0,"delayed":0,"failed":2}` |
| purge final | `{"waiting":0,"active":0,"delayed":0,"failed":2}` |
| queueFailed | 4 |

### 对话全链路

| 指标 | 值 |
|---|---|
| n | 10 |
| errors | 0 |
| emptyAnswers | 0 |
| patternMiss | 0 |
| chatErrorRate | 0.00% |
| avgMs | 9131.6 |
| p50Ms | 9138 |
| p95Ms | 10745 |
| p99Ms | 10745 |
| maxMs | 10745 |

### 判定

- health errorRate ≤ 5%: OK
- queue failed = 0（若启用）: FAIL
- chat error+empty ≤ 15%（若未跳过）: OK
- chat pattern（仅 STRICT）: OK
