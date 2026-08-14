# E2E 报表

- **结果**: FAIL
- **生成时间**: 2026-08-14T13:01:55.158Z

### 覆盖说明

- **vault**：原文库 CRUD 冒烟（inprocess / API / Playwright）
- **对话主链**：Web 登录 → 会话 → 多轮问答 → brain pipeline（API + Playwright）

### 步骤总览

| 步骤 | 结果 | exit | 耗时 |
|---|---|---:|---:|
| Inprocess vault list（pipeline 旁路） | PASS | 0 | 27938ms |
| API E2E vault list/create/open/delete | PASS | 0 | 14967ms |
| API E2E 对话主链（姓名/年龄/手机） | PASS | 0 | 20253ms |
| Playwright（vault UI + 对话主链） | FAIL | 1 | 107729ms |

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

```

Running 2 tests using 2 workers

(node:36977) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:36978) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:36977) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:36978) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
  ✓  1 [chromium] › e2e/chat-chain.spec.ts:34:7 › chat dialogue chain › login → 姓名 → 年龄 → 手机（对话主链） (21.2s)
  ✘  2 [chromium] › e2e/vault-workspace.spec.ts:32:7 › vault workspace UI › login → list → 点击新建 txt → 删除 (1.7m)


  1) [chromium] › e2e/vault-workspace.spec.ts:32:7 › vault workspace UI › login → list → 点击新建 txt → 删除 

    Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeEnabled[2m([22m[2m)[22m failed

    Locator: getByRole('button', { name: /删除 .+\.txt/i, disabled: false }).last()
    Expected: enabled
    Timeout: 90000ms
    Error: element(s) not found

    Call log:
    [2m  - Expect "toBeEnabled" with timeout 90000ms[22m
    [2m  - waiting for getByRole('button', { name: /删除 .+\.txt/i, disabled: false }).last()[22m


      83 |       .getByRole("button", { name: /删除 .+\.txt/i, disabled: false })
      84 |       .last();
    > 85 |     await expect(deleteBtn).toBeEnabled({ timeout: 90_000 });
         |                             ^
      86 |     await deleteBtn.click();
      87 |     await expect(
      88 |       page.getByText(/已硬删除|Hard-deleted|入队硬删/i).first()
        at /Users/panzhanfei/Desktop/个人/project/own/fambrain-agents/apps/web/e2e/vault-workspace.spec.ts:85:29

    Error Context: ../../reports/playwright/test-results/vault-workspace-vault-work-151ca-ogin-→-list-→-点击新建-txt-→-删除-chromium/error-context.md

  1 failed
    [chromium] › e2e/vault-workspace.spec.ts:32:7 › vault workspace UI › login → list → 点击新建 txt → 删除 
  1 passed (1.7m)

```
