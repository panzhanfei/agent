# 压测报表（中档）

压测报表（中档）

- **结果**: PASS
- **生成时间**: 2026-08-10T09:14:38.017Z

### 参数

| 项 | 值 |
|---|---|
| base | `http://127.0.0.1:3001` |
| concurrency | 20 |
| requests | 200 |
| corpusJobs | 80 |
| corpusUserId | `cmp9ihokn00000mbmhwh6gn0b` |
| queue enabled | true |

### Health 并发

| 指标 | 值 |
|---|---|
| n | 200 |
| errors | 0 |
| errorRate | 0.00% |
| avgMs | 22.16 |
| p50Ms | 9 |
| p95Ms | 83 |
| p99Ms | 135 |
| maxMs | 142 |

### Corpus Queue

| 指标 | 值 |
|---|---|
| materializeJobs | 80 |
| digestMs | 5121 |
| peakBacklog | 80 |
| materialize final | `{"waiting":0,"active":0,"delayed":0,"failed":0}` |
| purge final | `{"waiting":0,"active":0,"delayed":0,"failed":0}` |
| queueFailed | 0 |

### 判定

- health errorRate ≤ 5%: OK
- queue failed = 0（若启用）: OK
