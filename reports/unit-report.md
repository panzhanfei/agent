# 单元测试报表

- **结果**: PASS
- **生成时间**: 2026-08-12T13:42:16.124Z

### 汇总

| 指标 | 值 |
|---|---|
| exitCode | 0 |
| total | 185 |
| passed | 185 |
| failed | 0 |
| pending | 0 |
| elapsedMs | 55496 |

### 按文件

| 文件 | passed | failed | total |
|---|---:|---:|---:|
| `packages/auth/src/national-id.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/bm25.test.ts` | 2 | 0 | 2 |
| `packages/corpus/src/recall-tokenize.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/workspace-fs.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/workspace-paths.test.ts` | 3 | 0 | 3 |
| `packages/test-kit/src/check-dependency-tree.test.ts` | 3 | 0 | 3 |
| `packages/infra/src/cache/keys.test.ts` | 2 | 0 | 2 |
| `packages/db/src/repos/conversations-edit.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/execution/control-plane.test.ts` | 11 | 0 | 11 |
| `apps/brain-service/tests/execution/dag-partial-reexec.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/execution/empty-policy.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/execution/global-rebatch.test.ts` | 9 | 0 | 9 |
| `apps/brain-service/tests/execution/slot-subgraph-shell.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/content-summarizer/build-source-text.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/content-summarizer/summarize-route.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/corpus-lister/pure-list-route.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts` | 6 | 0 | 6 |
| `apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts` | 12 | 0 | 12 |
| `apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts` | 8 | 0 | 8 |
| `apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts` | 7 | 0 | 7 |
| `apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/hitl-write/compose-and-lifecycle.test.ts` | 7 | 0 | 7 |
| `apps/brain-service/tests/hitl-write/path-plan-corpus-edit.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/hitl-write/paths-and-actions.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/hitl-write/propose-abc.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tool-orchestrator/match-report.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tools/compute-age.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tools/compute-tenure.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/tools/external-link-query-regression.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tools/extract-tools.test.ts` | 11 | 0 | 11 |
| `apps/brain-service/tests/tools/translate-lang.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/pipeline/routes-after-organizer.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/user-memory-extract/legalize.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts` | 2 | 0 | 2 |

### 失败用例

_无_

### 终端尾部

```
ct/own/fambrain-agents

 ✓ packages/corpus/src/recall-tokenize.test.ts (3 tests) 13ms
 ✓ packages/test-kit/src/check-dependency-tree.test.ts (3 tests) 40ms
 ✓ packages/db/src/repos/conversations-edit.test.ts (4 tests) 626ms
   ✓ editRegenerateMessageBodySchema > accepts content and optional turnId  437ms
 ✓ apps/brain-service/tests/execution/control-plane.test.ts (11 tests) 62ms
 ✓ apps/brain-service/tests/tools/extract-tools.test.ts (11 tests) 60ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts (4 tests) 13ms
 ✓ packages/corpus/src/workspace-fs.test.ts (3 tests) 203ms
 ✓ apps/brain-service/tests/hitl-write/compose-and-lifecycle.test.ts (7 tests) 108ms
 ✓ apps/brain-service/tests/hitl-write/propose-abc.test.ts (5 tests) 30ms
 ✓ apps/brain-service/tests/execution/global-rebatch.test.ts (9 tests) 70ms
 ✓ apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts (3 tests) 58ms
 ✓ apps/brain-service/tests/tools/compute-age.test.ts (4 tests) 49ms
 ✓ apps/brain-service/tests/tools/translate-lang.test.ts (4 tests) 35ms
 ✓ apps/brain-service/tests/tool-orchestrator/match-report.test.ts (4 tests) 28ms
 ✓ apps/brain-service/tests/execution/dag-partial-reexec.test.ts (5 tests) 24ms
 ✓ apps/brain-service/tests/execution/empty-policy.test.ts (5 tests) 27ms
 ✓ apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts (6 tests) 22ms
 ✓ apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts (5 tests) 36ms
 ✓ apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts (7 tests) 39ms
 ✓ apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts (12 tests) 171ms
 ✓ apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts (8 tests) 43ms
 ✓ apps/brain-service/tests/execution/slot-subgraph-shell.test.ts (2 tests) 45ms
 ✓ apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts (2 tests) 18ms
 ✓ apps/brain-service/tests/tools/external-link-query-regression.test.ts (4 tests) 76ms
 ✓ packages/corpus/src/bm25.test.ts (2 tests) 16ms
 ✓ apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts (2 tests) 18ms
 ✓ apps/brain-service/tests/user-memory-extract/legalize.test.ts (2 tests) 49ms
 ✓ packages/infra/src/cache/keys.test.ts (2 tests) 19ms
 ✓ apps/brain-service/tests/hitl-write/paths-and-actions.test.ts (3 tests) 33ms
 ✓ apps/brain-service/tests/content-summarizer/build-source-text.test.ts (1 test) 18ms
 ✓ apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts (2 tests) 37ms
 ✓ packages/auth/src/national-id.test.ts (3 tests) 20ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts (5 tests) 19ms
 ✓ apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts (1 test) 23ms
 ✓ apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts (4 tests) 28ms
 ✓ packages/corpus/src/workspace-paths.test.ts (3 tests) 37ms
 ✓ apps/brain-service/tests/tools/compute-tenure.test.ts (3 tests) 20ms
 ✓ apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts (4 tests) 19ms
 ✓ apps/brain-service/tests/corpus-lister/pure-list-route.test.ts (2 tests) 20ms
 ✓ apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts (4 tests) 62ms
 ✓ apps/brain-service/tests/hitl-write/path-plan-corpus-edit.test.ts (1 test) 76ms
 ✓ apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts (2 tests) 26ms
 ✓ apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts (4 tests) 15ms
 ✓ apps/brain-service/tests/content-summarizer/summarize-route.test.ts (2 tests) 11ms
 ✓ apps/brain-service/tests/pipeline/routes-after-organizer.test.ts (2 tests) 10ms

 Test Files  45 passed (45)
      Tests  185 passed (185)
   Start at  21:41:22
   Duration  53.25s (transform 15.01s, setup 0ms, collect 571.62s, tests 2.47s, environment 52ms, prepare 41.08s)

JSON report written to /Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/reports/vitest-raw.json


```
