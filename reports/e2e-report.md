# E2E 报表

- **结果**: PASS
- **生成时间**: 2026-08-19T10:44:03.318Z

### 覆盖说明

- **vault**：原文库 CRUD 冒烟（inprocess / API / Playwright）
- **对话主链**：Web 登录 → 会话 → 多轮问答 → brain pipeline（API + Playwright）
- **文件 HITL**：Resume 缺 jobId 400、新 QA 顶替 workspace、附件总结出闸 / 保留 save_offer / 取消（API + Playwright 弹窗）

### 步骤总览

| 步骤 | 结果 | exit | 耗时 |
|---|---|---:|---:|
| Inprocess vault list（pipeline 旁路） | PASS | 0 | 9750ms |
| API E2E vault list/create/open/delete | PASS | 0 | 2361ms |
| API E2E 对话主链（姓名/年龄/手机） | PASS | 0 | 20488ms |
| API E2E 文件 HITL（jobId / save_offer / 新 QA） | PASS | 0 | 23059ms |
| Playwright（vault UI + 对话主链） | PASS | 0 | 27972ms |

### 环境

| 项 | 值 |
|---|---|
| E2E_BASE_URL | `http://127.0.0.1:3000` |
| E2E_USER | `panzhanfei` |
| AUTH_COOKIE_SECURE | `0` |
| Playwright HTML | `reports/playwright/html` |

### 失败/日志尾部

#### Inprocess vault list（pipeline 旁路）

_通过_

#### API E2E vault list/create/open/delete

_通过_

#### API E2E 对话主链（姓名/年龄/手机）

_通过_

#### API E2E 文件 HITL（jobId / save_offer / 新 QA）

_通过_

#### Playwright（vault UI + 对话主链）

_通过_
