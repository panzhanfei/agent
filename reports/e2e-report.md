# E2E 报表

- **结果**: PASS
- **生成时间**: 2026-08-10T10:40:26.714Z

### 覆盖说明

- **vault**：原文库 CRUD 冒烟（inprocess / API / Playwright）
- **对话主链**：Web 登录 → 会话 → 多轮问答 → brain pipeline（API + Playwright）

### 步骤总览

| 步骤 | 结果 | exit | 耗时 |
|---|---|---:|---:|
| Inprocess vault list（pipeline 旁路） | PASS | 0 | 12787ms |
| API E2E vault list/create/open/delete | PASS | 0 | 10167ms |
| API E2E 对话主链（姓名/年龄/手机） | PASS | 0 | 15032ms |
| Playwright（vault UI + 对话主链） | PASS | 0 | 17941ms |

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

#### Playwright（vault UI + 对话主链）

_通过_
