# 单元测试报表

- **结果**: PASS
- **生成时间**: 2026-08-19T10:19:10.677Z

### 汇总

| 指标 | 值 |
|---|---|
| exitCode | 0 |
| total | 227 |
| passed | 227 |
| failed | 0 |
| pending | 0 |
| elapsedMs | 35510 |

### 按文件

| 文件 | passed | failed | total |
|---|---:|---:|---:|
| `packages/auth/src/national-id.test.ts` | 3 | 0 | 3 |
| `packages/test-kit/src/check-dependency-tree.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/corpus-lister/pure-list-route.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/content-summarizer/build-source-text.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/content-summarizer/summarize-route.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/execution/control-plane.test.ts` | 10 | 0 | 10 |
| `apps/brain-service/tests/execution/dag-partial-reexec.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/execution/empty-policy.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/execution/file-thread.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/execution/global-rebatch.test.ts` | 9 | 0 | 9 |
| `apps/brain-service/tests/execution/pipeline-graph-compile.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/execution/pipeline-pause-resume.test.ts` | 8 | 0 | 8 |
| `apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts` | 7 | 0 | 7 |
| `apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts` | 15 | 0 | 15 |
| `apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts` | 8 | 0 | 8 |
| `apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts` | 9 | 0 | 9 |
| `apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts` | 7 | 0 | 7 |
| `apps/brain-service/tests/knowledge-manager/recall-doc-kinds.test.ts` | 8 | 0 | 8 |
| `apps/brain-service/tests/server/pipeline-stream-schema.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/pipeline/orchestrate-resume.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/pipeline/routes-after-organizer.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/sideline-file/decide.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/tool-orchestrator/match-report.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/user-memory-extract/legalize.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/vault-save-gate/save-gate.test.ts` | 6 | 0 | 6 |
| `apps/brain-service/tests/tools/compute-age.test.ts` | 6 | 0 | 6 |
| `apps/brain-service/tests/tools/compute-tenure.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/tools/external-link-query-regression.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tools/extract-tools.test.ts` | 11 | 0 | 11 |
| `apps/brain-service/tests/tools/translate-lang.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/vault-write/action-lifecycle.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts` | 9 | 0 | 9 |
| `packages/corpus/src/paths/corpus-noise.test.ts` | 1 | 0 | 1 |
| `packages/corpus/src/vector/bm25.test.ts` | 2 | 0 | 2 |
| `packages/corpus/src/workspace/workspace-fs.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/workspace/workspace-paths.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/qdrant/qdrant-sparse.test.ts` | 2 | 0 | 2 |
| `packages/corpus/src/qdrant/recall-tokenize.test.ts` | 3 | 0 | 3 |
| `packages/infra/src/cache/keys.test.ts` | 2 | 0 | 2 |
| `packages/db/src/repos/conversations-edit.test.ts` | 4 | 0 | 4 |
| `packages/db/src/repos/conversations-keep-file-jobs.test.ts` | 1 | 0 | 1 |
| `packages/db/src/repos/file-jobs.test.ts` | 2 | 0 | 2 |
| `packages/corpus/src/vector/doc-kind/doc-kind.test.ts` | 6 | 0 | 6 |

### 失败用例

_无_

### 终端尾部

```
s) 64ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts (4 tests) 8ms
 ✓ apps/brain-service/tests/execution/control-plane.test.ts (10 tests) 58ms
 ✓ packages/corpus/src/qdrant/recall-tokenize.test.ts (3 tests) 19ms
 ✓ apps/brain-service/tests/tools/translate-lang.test.ts (4 tests) 9ms
 ✓ packages/test-kit/src/check-dependency-tree.test.ts (3 tests) 30ms
 ✓ apps/brain-service/tests/execution/global-rebatch.test.ts (9 tests) 18ms
 ✓ apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts (9 tests) 15ms
 ✓ apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts (15 tests) 26ms
 ✓ apps/brain-service/tests/execution/empty-policy.test.ts (5 tests) 12ms
 ✓ apps/brain-service/tests/tools/external-link-query-regression.test.ts (4 tests) 19ms
 ✓ apps/brain-service/tests/tools/extract-tools.test.ts (11 tests) 31ms
 ✓ apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts (9 tests) 28ms
 ✓ apps/brain-service/tests/tools/compute-tenure.test.ts (5 tests) 19ms
 ✓ apps/brain-service/tests/vault-save-gate/save-gate.test.ts (6 tests) 22ms
 ✓ apps/brain-service/tests/execution/pipeline-graph-compile.test.ts (1 test) 21ms
 ✓ apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts (2 tests) 8ms
 ✓ apps/brain-service/tests/execution/pipeline-pause-resume.test.ts (8 tests) 120ms
 ✓ apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts (3 tests) 26ms
 ✓ apps/brain-service/tests/tool-orchestrator/match-report.test.ts (4 tests) 26ms
 ✓ packages/corpus/src/vector/bm25.test.ts (2 tests) 7ms
 ✓ apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts (4 tests) 9ms
 ✓ packages/corpus/src/workspace/workspace-paths.test.ts (3 tests) 8ms
 ✓ apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts (7 tests) 12ms
 ✓ apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts (2 tests) 9ms
 ✓ apps/brain-service/tests/vault-write/action-lifecycle.test.ts (3 tests) 10ms
 ✓ packages/corpus/src/qdrant/qdrant-sparse.test.ts (2 tests) 17ms
 ✓ apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts (1 test) 7ms
 ✓ apps/brain-service/tests/execution/dag-partial-reexec.test.ts (5 tests) 13ms
 ✓ packages/corpus/src/paths/corpus-noise.test.ts (1 test) 6ms
 ✓ apps/brain-service/tests/knowledge-manager/recall-doc-kinds.test.ts (8 tests) 15ms
 ✓ apps/brain-service/tests/execution/file-thread.test.ts (1 test) 8ms
 ✓ packages/infra/src/cache/keys.test.ts (2 tests) 7ms
 ✓ apps/brain-service/tests/user-memory-extract/legalize.test.ts (2 tests) 14ms
 ✓ apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts (2 tests) 50ms
 ✓ apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts (8 tests) 82ms
 ✓ apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts (7 tests) 90ms
 ✓ apps/brain-service/tests/corpus-lister/pure-list-route.test.ts (2 tests) 23ms
 ✓ apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts (2 tests) 16ms
 ✓ apps/brain-service/tests/tools/compute-age.test.ts (6 tests) 16ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts (5 tests) 14ms
 ✓ apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts (5 tests) 14ms
 ✓ apps/brain-service/tests/pipeline/routes-after-organizer.test.ts (2 tests) 15ms
 ✓ apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts (4 tests) 15ms
 ✓ apps/brain-service/tests/sideline-file/decide.test.ts (2 tests) 8ms
 ✓ apps/brain-service/tests/content-summarizer/summarize-route.test.ts (2 tests) 17ms
 ✓ apps/brain-service/tests/pipeline/orchestrate-resume.test.ts (1 test) 8ms

 Test Files  54 passed (54)
      Tests  227 passed (227)
   Start at  18:18:36
   Duration  33.96s (transform 6.76s, setup 0ms, collect 388.87s, tests 1.52s, environment 22ms, prepare 18.21s)

JSON report written to /Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/reports/vitest-raw.json


```
