# VaultSaveGate（写回闸门）

独立图节点：附件总结/翻译或粘贴长文总结之后，一次 HITL 确认是否写入原文库。写盘仍复用 VaultWrite 的 `create_file` + materialize。

## 入口

- 图节点：`vaultSaveGate`（`runVaultSaveGateNode`）
- 接在 Analyst / ContentSummarizer 之后 → `persistTurnEnd`
- 出闸：附件 `summarize`/`translate`，或粘贴长文总结（`summarize` 且无 `searchQuery`、无 pathPlan 步）。查库摘要与普通 QA 不出
- 聊天按钮：确定入库（`clientHandler: vault_save_name` → 文件名弹窗，确认才 Resume）| 取消（Resume 不写盘）
- 聊天附件不再 `ingest`；旧 `ingest` 合法化为 `summarize`

## 本地验证

```bash
pnpm test:unit -- apps/brain-service/tests/vault-save-gate
cd apps/brain-service && pnpm exec tsx --env-file=../../.env scripts/eval/run-eval.ts --vault-only
```
