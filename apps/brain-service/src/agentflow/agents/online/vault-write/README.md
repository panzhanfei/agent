# VaultWrite（原文库）

用户只编辑 `vault/originals/workspace/` 下的 `.txt` 与文件夹；系统语料化到 `corpus/personal/imports/workspace/` 并更新向量。

## 入口

- PathKind：`vault_workspace`
- UI exact-match：`我的原文库`、`__FAMBRAIN_VAULT_WS_*__`
- 图节点：`vaultWorkspace` → `planSlotJoin`

## 本地验证

```bash
pnpm test:unit -- apps/brain-service/tests/vault-write packages/corpus/src/workspace
cd apps/brain-service && pnpm exec tsx --env-file=../../.env scripts/eval/run-eval.ts --vault-only
cd apps/brain-service && pnpm run e2e:inprocess:vault
# 可选队列：CORPUS_QUEUE_ENABLED=1 + pnpm run corpus-worker
```
