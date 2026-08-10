#!/usr/bin/env node
/**
 * E2E 门禁：inprocess vault → API vault → API 对话主链 → Playwright（vault + chat）。
 * 汇总写入 reports/e2e-report + reports/GATE-REPORT.md。
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportsDir, writeGateReport } from "../_gate-report";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);
const brain = path.join(root, "apps/brain-service");
const web = path.join(root, "apps/web");

type StepResult = {
  id: string;
  label: string;
  pass: boolean;
  exitCode: number | null;
  elapsedMs: number;
  logTail: string;
};

const run = async (
  id: string,
  label: string,
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv
): Promise<StepResult> => {
  const started = Date.now();
  console.log(`\n[e2e-gate] ▶ ${label}`);
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (b: Buffer) => {
    const s = b.toString();
    out += s;
    process.stdout.write(s);
  });
  child.stderr.on("data", (b: Buffer) => {
    const s = b.toString();
    out += s;
    process.stderr.write(s);
  });
  const exitCode = await new Promise<number | null>((resolve) => {
    child.on("close", (c) => resolve(c));
  });
  const pass = exitCode === 0;
  console.log(`[e2e-gate] ${pass ? "PASS" : "FAIL"} ${label} (${Date.now() - started}ms)`);
  return {
    id,
    label,
    pass,
    exitCode,
    elapsedMs: Date.now() - started,
    logTail: out.slice(-5000),
  };
};

const main = async () => {
  const steps: StepResult[] = [];

  steps.push(
    await run(
      "inprocess-vault",
      "Inprocess vault list（pipeline 旁路）",
      "pnpm",
      ["run", "e2e:inprocess:vault"],
      brain
    )
  );

  steps.push(
    await run(
      "api-vault",
      "API E2E vault list/create/open/delete",
      "pnpm",
      ["run", "e2e:api:vault"],
      brain
    )
  );

  steps.push(
    await run(
      "api-chat-chain",
      "API E2E 对话主链（姓名/年龄/手机）",
      "pnpm",
      ["run", "e2e:api:chat"],
      brain
    )
  );

  const pwReportDir = path.join(reportsDir(), "playwright");
  await mkdir(pwReportDir, { recursive: true });
  steps.push(
    await run(
      "playwright",
      "Playwright（vault UI + 对话主链）",
      "pnpm",
      ["exec", "playwright", "test", "--config=playwright.config.ts"],
      web,
      {
        E2E_BASE_URL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
      }
    )
  );

  const pass = steps.every((s) => s.pass);
  const body = [
    "### 覆盖说明",
    "",
    "- **vault**：原文库 CRUD 冒烟（inprocess / API / Playwright）",
    "- **对话主链**：Web 登录 → 会话 → 多轮问答 → brain pipeline（API + Playwright）",
    "",
    "### 步骤总览",
    "",
    `| 步骤 | 结果 | exit | 耗时 |`,
    `|---|---|---:|---:|`,
    ...steps.map(
      (s) =>
        `| ${s.label} | ${s.pass ? "PASS" : "FAIL"} | ${s.exitCode} | ${s.elapsedMs}ms |`
    ),
    "",
    "### 环境",
    "",
    `| 项 | 值 |`,
    `|---|---|`,
    `| E2E_BASE_URL | \`${process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000"}\` |`,
    `| E2E_USER | \`${process.env.E2E_USER ?? "panzhanfei"}\` |`,
    `| AUTH_COOKIE_SECURE | \`${process.env.AUTH_COOKIE_SECURE ?? ""}\` |`,
    `| Playwright HTML | \`reports/playwright/html\` |`,
    "",
    "### 失败/日志尾部",
    "",
    ...steps.flatMap((s) => [
      `#### ${s.label}`,
      "",
      s.pass ? "_通过_" : "```\n" + s.logTail + "\n```",
      "",
    ]),
  ].join("\n");

  await writeGateReport({
    kind: "e2e",
    title: "E2E 报表",
    pass,
    summary: {
      steps: steps.map(({ logTail: _l, ...rest }) => rest),
      passCount: steps.filter((s) => s.pass).length,
      failCount: steps.filter((s) => !s.pass).length,
    },
    markdownBody: body,
  });

  process.exit(pass ? 0 : 1);
};

main().catch(async (e) => {
  console.error(e);
  try {
    await writeGateReport({
      kind: "e2e",
      title: "E2E 报表",
      pass: false,
      summary: { error: e instanceof Error ? e.message : String(e) },
      markdownBody: `### 异常\n\n\`\`\`\n${e instanceof Error ? e.stack ?? e.message : String(e)}\n\`\`\`\n`,
    });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
