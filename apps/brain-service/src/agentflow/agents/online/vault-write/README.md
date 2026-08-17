# VaultWrite（原文库工作台）

用户只编辑 `vault/originals/workspace/` 下的 `.txt` 与文件夹；系统语料化到 `corpus/personal/imports/workspace/` 并更新向量。

附件/粘贴终稿确认入库见独立节点 [`vault-save-gate`](../vault-save-gate/)。

## 入口

- PathKind：`vault_workspace`（工作台，独占单槽）
- UI exact-match：`我的原文库`、`__FAMBRAIN_VAULT_WS_*__`（含「结束」`__FAMBRAIN_VAULT_WS_DONE__`）
- 图节点：`vaultWorkspace`（op → `interrupt({ kind: vault_wait })` 循环）。点「结束」或缺槽 → `persistTurnEnd`；不进 `planSlotJoin`

## 本地验证

```bash
pnpm test:unit -- apps/brain-service/tests/vault-write packages/corpus/src/workspace
cd apps/brain-service && pnpm exec tsx --env-file=../../.env scripts/eval/run-eval.ts --vault-only
cd apps/brain-service && pnpm run e2e:inprocess:vault
# 可选队列：CORPUS_QUEUE_ENABLED=1 + pnpm run corpus-worker
```
