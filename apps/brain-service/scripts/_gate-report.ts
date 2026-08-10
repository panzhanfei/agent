/**
 * 工程门禁报表（全部落在仓库根目录 reports/）：
 * - reports/{kind}-report.{md,json}
 * - reports/GATE-REPORT.md（四段合一：unit / eval / load / e2e）
 *
 * 分项文件：覆盖写。GATE：按 kind 段覆盖合并（非历史累加）。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type GateKind = "unit" | "eval" | "load" | "e2e";

const KIND_ORDER: GateKind[] = ["unit", "eval", "load", "e2e"];

const KIND_TITLE: Record<GateKind, string> = {
  unit: "单元测试",
  eval: "Eval（Golden / Probe）",
  load: "压测（Load）",
  e2e: "E2E（API + Inprocess + Playwright）",
};

export const repoRootFromScripts = (): string =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const reportsDir = (): string => path.join(repoRootFromScripts(), "reports");

/** 报表里把绝对路径收成相对仓库根，避免噪音。 */
export const relRepoPath = (p: string): string => {
  const root = repoRootFromScripts();
  const norm = p.replace(/\\/g, "/");
  const rootNorm = root.replace(/\\/g, "/");
  if (norm.startsWith(rootNorm + "/")) return norm.slice(rootNorm.length + 1);
  if (norm.startsWith(rootNorm)) return norm.slice(rootNorm.length).replace(/^\//, "");
  return p;
};

const sectionMarker = (kind: GateKind): string =>
  `<!-- GATE-SECTION:${kind} -->`;

/** 去掉段首重复的 `# …` / 空行，避免 GATE 叠标题。 */
const stripLeadingH1 = (md: string): string => {
  let s = md.trim();
  while (/^#\s+.+/m.test(s.split("\n")[0] ?? "")) {
    s = s.replace(/^#\s+.+\n*/, "").trim();
  }
  return s;
};

const extractSection = (md: string, kind: GateKind): string | null => {
  const start = sectionMarker(kind);
  const idx = md.indexOf(start);
  if (idx < 0) return null;
  const after = md.slice(idx + start.length);
  const next = after.search(/<!-- GATE-SECTION:/);
  const body = (next < 0 ? after : after.slice(0, next)).trim();
  return body ? stripLeadingH1(body) : null;
};

const sectionHasPass = (body: string): boolean =>
  /^\s*-\s*\*\*结果\*\*:\s*PASS/m.test(body) ||
  /\*\*结果\*\*:\s*PASS/.test(body);

export const writeGateReport = async (input: {
  kind: GateKind;
  title: string;
  pass: boolean;
  summary: Record<string, unknown>;
  markdownBody: string;
}): Promise<{ jsonPath: string; mdPath: string; gatePath: string }> => {
  const dir = reportsDir();
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString();
  const payload = {
    kind: input.kind,
    title: input.title,
    pass: input.pass,
    generatedAt: stamp,
    ...input.summary,
  };
  const base = `${input.kind}-report`;
  const jsonPath = path.join(dir, `${base}.json`);
  const mdPath = path.join(dir, `${base}.md`);

  // 分项正文：结果行 + body（不含外层 H1；standalone / GATE 各自加一层标题）
  const sectionBody = [
    `- **结果**: ${input.pass ? "PASS" : "FAIL"}`,
    `- **生成时间**: ${stamp}`,
    "",
    input.markdownBody.trim(),
    "",
  ].join("\n");

  await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  const standaloneMd = [`# ${input.title}`, "", sectionBody].join("\n");
  await writeFile(mdPath, standaloneMd, "utf8");

  const gatePath = path.join(dir, "GATE-REPORT.md");
  let existing = "";
  try {
    existing = await readFile(gatePath, "utf8");
  } catch {
    existing = "";
  }

  const sections = new Map<GateKind, string>();
  for (const k of KIND_ORDER) {
    if (k === input.kind) {
      sections.set(k, sectionBody);
      continue;
    }
    const prev = extractSection(existing, k);
    if (prev) {
      sections.set(k, prev);
      continue;
    }
    try {
      const side = await readFile(path.join(dir, `${k}-report.md`), "utf8");
      sections.set(k, stripLeadingH1(side));
    } catch {
      /* skip */
    }
  }

  const overallPass = KIND_ORDER.every((k) => {
    const body = sections.get(k);
    if (!body) return false;
    return sectionHasPass(body);
  });
  const known = KIND_ORDER.filter((k) => sections.has(k));
  const statusLine =
    known.length === 0
      ? "尚未生成任何分项"
      : known
          .map((k) => {
            const body = sections.get(k)!;
            return `${k}:${sectionHasPass(body) ? "PASS" : "FAIL"}`;
          })
          .join(" · ");

  const parts = [
    `# FamBrain 工程门禁总报表`,
    "",
    `- **汇总状态**: ${known.length === KIND_ORDER.length ? (overallPass ? "PASS" : "FAIL") : "PARTIAL"}`,
    `- **分项**: ${statusLine}`,
    `- **最后更新**: ${stamp}`,
    `- **目录**: \`reports/\``,
    `- **机器可读**: \`reports/{unit,eval,load,e2e}-report.json\``,
    `- **写入策略**: 分项覆盖；GATE 按段覆盖合并（非历史累加）`,
    "",
    `> 分层门禁：unit / eval / load / e2e。Load 含 health+队列+对话全链路；E2E 含 vault 与对话主链。`,
    "",
  ];
  for (const k of KIND_ORDER) {
    parts.push(sectionMarker(k));
    parts.push("");
    parts.push(`# ${KIND_TITLE[k]}`);
    parts.push("");
    if (sections.has(k)) {
      parts.push(stripLeadingH1(sections.get(k)!));
    } else {
      parts.push(`_尚未生成（跑对应门禁后自动写入）_`);
      parts.push("");
    }
    parts.push("");
  }
  await writeFile(gatePath, parts.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");

  console.log(`[report] wrote ${mdPath}`);
  console.log(`[report] wrote ${jsonPath}`);
  console.log(`[report] updated ${gatePath}`);
  return { jsonPath, mdPath, gatePath };
};
