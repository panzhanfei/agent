#!/usr/bin/env node
/**
 * 跑 vitest 全量单元测试并写入门禁报表。
 */
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { relRepoPath, reportsDir, writeGateReport } from "./_gate-report";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const runVitest = async (): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
  json: Record<string, unknown> | null;
}> => {
  const outDir = reportsDir();
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "vitest-raw.json");

  const args = [
    "exec",
    "vitest",
    "run",
    "--reporter=default",
    "--reporter=json",
    `--outputFile.json=${jsonPath}`,
  ];

  const child = spawn("pnpm", args, {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (b: Buffer) => {
    const s = b.toString();
    stdout += s;
    process.stdout.write(s);
  });
  child.stderr.on("data", (b: Buffer) => {
    const s = b.toString();
    stderr += s;
    process.stderr.write(s);
  });

  const code = await new Promise<number | null>((resolve) => {
    child.on("close", (c) => resolve(c));
  });

  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(await readFile(jsonPath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    json = null;
  }
  return { code, stdout, stderr, json };
};

type VitestFile = {
  name?: string;
  assertionResults?: Array<{
    title?: string;
    fullName?: string;
    status?: string;
    failureMessages?: string[];
    duration?: number;
  }>;
};

const main = async () => {
  const started = Date.now();
  const { code, stdout, stderr, json } = await runVitest();
  const elapsedMs = Date.now() - started;

  const numTotalTests = Number(json?.numTotalTests ?? 0);
  const numPassedTests = Number(json?.numPassedTests ?? 0);
  const numFailedTests = Number(json?.numFailedTests ?? 0);
  const numPendingTests = Number(json?.numPendingTests ?? 0);
  const success = Boolean(json?.success ?? code === 0);
  const pass = success && code === 0 && numFailedTests === 0;

  const files = (json?.testResults as VitestFile[] | undefined) ?? [];
  const failedRows: string[] = [];
  const fileRows: string[] = [];
  for (const f of files) {
    const assertions = f.assertionResults ?? [];
    const failed = assertions.filter((a) => a.status === "failed").length;
    const passed = assertions.filter((a) => a.status === "passed").length;
    fileRows.push(
      `| \`${relRepoPath(f.name ?? "?")}\` | ${passed} | ${failed} | ${assertions.length} |`
    );
    for (const a of assertions) {
      if (a.status !== "failed") continue;
      failedRows.push(
        `- **${a.fullName ?? a.title ?? "?"}**\n\n\`\`\`\n${(a.failureMessages ?? []).join("\n").slice(0, 1200)}\n\`\`\``
      );
    }
  }

  const body = [
    "### 汇总",
    "",
    `| 指标 | 值 |`,
    `|---|---|`,
    `| exitCode | ${code} |`,
    `| total | ${numTotalTests} |`,
    `| passed | ${numPassedTests} |`,
    `| failed | ${numFailedTests} |`,
    `| pending | ${numPendingTests} |`,
    `| elapsedMs | ${elapsedMs} |`,
    "",
    "### 按文件",
    "",
    `| 文件 | passed | failed | total |`,
    `|---|---:|---:|---:|`,
    ...(fileRows.length ? fileRows : ["| _(无 JSON 明细)_ | - | - | - |"]),
    "",
    "### 失败用例",
    "",
    failedRows.length ? failedRows.join("\n\n") : "_无_",
    "",
    "### 终端尾部",
    "",
    "```",
    (stdout + "\n" + stderr).slice(-4000),
    "```",
    "",
  ].join("\n");

  await writeGateReport({
    kind: "unit",
    title: "单元测试报表",
    pass,
    summary: {
      exitCode: code,
      numTotalTests,
      numPassedTests,
      numFailedTests,
      numPendingTests,
      elapsedMs,
      success,
    },
    markdownBody: body,
  });

  process.exit(pass ? 0 : 1);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
