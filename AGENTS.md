<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Monorepo 布局

- **Web + BFF**：`apps/web/`（Next.js，`output: standalone`）
- **Brain 服务**：`apps/brain-service/`（HTTP，`BRAIN_SERVICE_PORT`，Web 通过 `BRAIN_SERVICE_URL` 调用）
- **DB / Auth / Brain 公共包**：`packages/*`
- **环境变量**：仓库根目录 `.env` 唯一来源；端口用 `PORT` / `OLLAMA_HOST`+`OLLAMA_PORT` / `QDRANT_HOST`+`QDRANT_PORT`（完整 URL 变量可覆盖）
- **语料 / 向量库**：`data/doc/`；Qdrant（语料 dense+sparse，Mem0 dense-only）
- **本地 Qdrant**：`pnpm run qdrant:server` 或 `pnpm dev` 自动 `docker compose up -d qdrant`

## 模块目录约定（详见 `.cursor/rules/module-folder-conventions.mdc`）

- 每个职责文件夹：`index.ts`（聚合导出）+ `interface.ts`（类型）
- 图节点：单节点写包根 `index.ts`；多节点写 `子目录/index.ts`；**不建** `node/`
- 同级 import 用 `./`；跨目录用 `@.../<folder>`，禁止深挖实现文件

## Agent 硬编码（必读）

生产路径**不许硬编码**问句口语、Mem0 字段名表、场景/人名分支来猜意图或补 plan；只信 Intake 结构化字段 + schema→executor。详见 `.cursor/rules/no-scene-hardcoding.mdc`（`alwaysApply: true`）。
<!-- END:nextjs-agent-rules -->
