# 单元测试报表

- **结果**: PASS
- **生成时间**: 2026-08-10T10:33:46.771Z

### 汇总

| 指标 | 值 |
|---|---|
| exitCode | 0 |
| total | 171 |
| passed | 171 |
| failed | 0 |
| pending | 0 |
| elapsedMs | 61826 |

### 按文件

| 文件 | passed | failed | total |
|---|---:|---:|---:|
| `packages/auth/src/national-id.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/bm25.test.ts` | 2 | 0 | 2 |
| `packages/corpus/src/recall-tokenize.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/workspace-fs.test.ts` | 3 | 0 | 3 |
| `packages/corpus/src/workspace-paths.test.ts` | 3 | 0 | 3 |
| `packages/test-kit/src/check-dependency-tree.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/content-summarizer/build-source-text.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/content-summarizer/summarize-route.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/corpus-lister/pure-list-route.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/execution/control-plane.test.ts` | 11 | 0 | 11 |
| `apps/brain-service/tests/execution/global-rebatch.test.ts` | 9 | 0 | 9 |
| `apps/brain-service/tests/execution/slot-subgraph-shell.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/hitl-write/compose-and-lifecycle.test.ts` | 7 | 0 | 7 |
| `apps/brain-service/tests/hitl-write/path-plan-corpus-edit.test.ts` | 1 | 0 | 1 |
| `apps/brain-service/tests/hitl-write/paths-and-actions.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/hitl-write/propose-abc.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts` | 6 | 0 | 6 |
| `apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts` | 12 | 0 | 12 |
| `apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts` | 8 | 0 | 8 |
| `apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts` | 7 | 0 | 7 |
| `apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts` | 5 | 0 | 5 |
| `apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/pipeline/routes-after-organizer.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/tools/compute-age.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tools/compute-tenure.test.ts` | 3 | 0 | 3 |
| `apps/brain-service/tests/tools/external-link-query-regression.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tools/extract-tools.test.ts` | 11 | 0 | 11 |
| `apps/brain-service/tests/tools/translate-lang.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts` | 4 | 0 | 4 |
| `apps/brain-service/tests/user-memory-extract/legalize.test.ts` | 2 | 0 | 2 |
| `apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts` | 5 | 0 | 5 |
| `packages/db/src/repos/conversations-edit.test.ts` | 4 | 0 | 4 |
| `packages/infra/src/cache/keys.test.ts` | 2 | 0 | 2 |

### 失败用例

_无_

### 终端尾部

```

 RUN  v3.2.7 /Users/panzhanfei/Desktop/个人/project/own/fambrain-agents

 ✓ packages/test-kit/src/check-dependency-tree.test.ts (3 tests) 45ms
 ✓ apps/brain-service/tests/tools/external-link-query-regression.test.ts (4 tests) 47ms
 ✓ packages/db/src/repos/conversations-edit.test.ts (4 tests) 871ms
   ✓ editRegenerateMessageBodySchema > accepts content and optional turnId  627ms
 ✓ apps/brain-service/tests/execution/control-plane.test.ts (11 tests) 65ms
 ✓ apps/brain-service/tests/intake-coordinator/parse-user-fact-lift.test.ts (3 tests) 113ms
 ✓ apps/brain-service/tests/information-analyst/slice-hits-for-analyst-stream.test.ts (2 tests) 24ms
 ✓ apps/brain-service/tests/tools/extract-tools.test.ts (11 tests) 85ms
 ✓ packages/corpus/src/recall-tokenize.test.ts (3 tests) 26ms
 ✓ packages/corpus/src/workspace-fs.test.ts (3 tests) 158ms
 ✓ apps/brain-service/tests/execution/global-rebatch.test.ts (9 tests) 86ms
 ✓ packages/auth/src/national-id.test.ts (3 tests) 39ms
 ✓ apps/brain-service/tests/hitl-write/compose-and-lifecycle.test.ts (7 tests) 48ms
 ✓ apps/brain-service/tests/hitl-write/propose-abc.test.ts (5 tests) 36ms
 ✓ apps/brain-service/tests/tools/compute-tenure.test.ts (3 tests) 42ms
 ✓ apps/brain-service/tests/corpus-lister/flatten-list-retrieval.test.ts (2 tests) 30ms
 ✓ apps/brain-service/tests/tools/compute-age.test.ts (4 tests) 70ms
 ✓ apps/brain-service/tests/hitl-write/paths-and-actions.test.ts (3 tests) 41ms
 ✓ apps/brain-service/tests/knowledge-manager/entry-time-window.test.ts (4 tests) 18ms
 ✓ apps/brain-service/tests/content-summarizer/build-source-text.test.ts (1 test) 18ms
 ✓ packages/corpus/src/workspace-paths.test.ts (3 tests) 24ms
 ✓ packages/infra/src/cache/keys.test.ts (2 tests) 26ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-enumeration-pagination.test.ts (4 tests) 75ms
 ✓ apps/brain-service/tests/doc-parser/parse-image-ocr-error.test.ts (1 test) 21ms
 ✓ apps/brain-service/tests/user-memory-extract/legalize.test.ts (2 tests) 98ms
 ✓ apps/brain-service/tests/tools/translate-lang.test.ts (4 tests) 18ms
 ✓ packages/corpus/src/bm25.test.ts (2 tests) 15ms
 ✓ apps/brain-service/tests/vault-write/path-plan-vault-workspace.test.ts (5 tests) 495ms
 ✓ apps/brain-service/tests/intake-coordinator/compile-path-plan.test.ts (12 tests) 451ms
 ✓ apps/brain-service/tests/intake-coordinator/effective-intake-question.test.ts (8 tests) 122ms
 ✓ apps/brain-service/tests/intake-coordinator/repair-retrieval-plan.test.ts (7 tests) 373ms
 ✓ apps/brain-service/tests/intake-coordinator/resolve-route-mode.test.ts (5 tests) 48ms
 ✓ apps/brain-service/tests/intake-coordinator/apply-attachment-action.test.ts (6 tests) 34ms
 ✓ apps/brain-service/tests/execution/slot-subgraph-shell.test.ts (2 tests) 414ms
   ✓ slot subgraph shell (phase 3) > compiles km-slot and tool-slot subgraphs  351ms
 ✓ apps/brain-service/tests/plan-fanout/merge-composite-dag.test.ts (2 tests) 28ms
 ✓ apps/brain-service/tests/hitl-write/path-plan-corpus-edit.test.ts (1 test) 19ms
 ✓ apps/brain-service/tests/knowledge-manager/facet-key-pagination.test.ts (4 tests) 20ms
 ✓ apps/brain-service/tests/corpus-lister/pure-list-route.test.ts (2 tests) 18ms
 ✓ apps/brain-service/tests/tool-orchestrator/field-catalog.test.ts (4 tests) 11ms
 ✓ apps/brain-service/tests/tool-orchestrator/enrich-plan.test.ts (2 tests) 20ms
 ✓ apps/brain-service/tests/intake-coordinator/enumeration-target.test.ts (4 tests) 16ms
 ✓ apps/brain-service/tests/pipeline/routes-after-organizer.test.ts (2 tests) 8ms
 ✓ apps/brain-service/tests/content-summarizer/summarize-route.test.ts (2 tests) 5ms

 Test Files  42 passed (42)
      Tests  171 passed (171)
   Start at  18:32:46
   Duration  59.63s (transform 16.30s, setup 0ms, collect 658.26s, tests 4.22s, environment 53ms, prepare 42.84s)

JSON report written to /Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/reports/vitest-raw.json


```
