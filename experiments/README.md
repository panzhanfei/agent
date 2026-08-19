# FamBrain 实验脚本（触达级）

与主聊天链路 **解耦**，用于 P1 技术栈触达与面试演示。实现位于 `apps/brain-service/scripts/experiments/`。

| 命令（仓库根目录） | 技术 | 说明 |
|-------------------|------|------|
| `pnpm run experiment:mcp-vault` | MCP SDK | stdio MCP Server，工具 `list_vault_files` 只读列 `vault/`（**实验**；生产天气 MCP 在 `tools/mcp/server/weather`） |
| `pnpm run experiment:recall-compare -- <userId> "query"` | dense vs sparse recall | 同 query 对比 Qdrant 向量检索与 sparse（入库 BM25 TF） |
| `pnpm run experiment:vercel-ai -- "prompt"` | Vercel AI SDK | `streamText` + Ollama，主链仍用自研 SSE |
| `pnpm run experiment:bind-tools -- "问法"` | LangChain bindTools | 实验性 ReAct：LLM 自主选 FamBrain StructuredTool（**不进主 pipeline**） |
| `pnpm run experiment:bind-tools -- --schema-only` | LangChain bindTools | 仅验证 tool 绑定，不调用 Ollama |

**ContentSummarizer（D9）：**

| 命令 | 说明 |
|------|------|
| `pnpm run verify:content-summarizer` | Zod schema 单测 |
| `pnpm run summarize:document -- <file.md>` | CLI 摘要（跟 `CHAT_PROVIDER`） |

**MCP 配置示例（Cursor）：** command 填 `pnpm`，args 填 `run experiment:mcp-vault`（cwd 为仓库根目录）。
