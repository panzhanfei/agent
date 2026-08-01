# brain-service HTTP Server

Node `http` 入口：`src/server/index.ts`。

## 目录

```text
server/
├── index.ts       # listen + 路由表
├── routes/        # /health、/pipeline/stream
├── handlers/      # /documents/upload、/enumeration/list
├── middleware/    # JWT requireAuth
├── http/          # handleAsync、SSE、multipart、readJsonBody
└── schema/        # Zod 请求体校验
```

## 路由

| Path | Handler |
|------|---------|
| `GET /health` | `routes.handleHealth` |
| `POST /pipeline/stream` | `routes.handlePipelineStream` |
| `POST /pipeline/cancel` | `routes.handlePipelineCancel` |
| `POST /documents/upload` | `handlers.handleDocumentsUpload` |
| `POST /enumeration/list` | `handlers.handleEnumerationList` |

包外 import 走各子目录 `index.ts`（如 `@/server/http`、`@/server/handlers`）。
