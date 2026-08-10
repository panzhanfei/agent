/**
 * 工程门禁报表（全部落在仓库根目录 reports/）：
 * - reports/{kind}-report.{md,json}
 * - reports/GATE-REPORT.md（四段合一：unit / eval / load / e2e）
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

const sectionMarker = (kind: GateKind): string =>
  `<!-- GATE-SECTION:${kind} -->`;

const extractSection = (md: string, kind: GateKind): string | null => {
  const start = sectionMarker(kind);
  const idx = md.indexOf(start);
  if (idx < 0) return null;
  const after = md.slice(idx + start.length);
  const next = after.search(/<!-- GATE-SECTION:/);
  const body = (next < 0 ? after : after.slice(0, next)).trim();
  return body || null;
};

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
  const sectionBody = [
    `## ${input.title}`,
    "",
    `- **结果**: ${input.pass ? "PASS" : "FAIL"}`,
    `- **生成时间**: ${stamp}`,
    "",
    input.markdownBody.trim(),
    "",
  ].join("\n");

  await writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  const standaloneMd = `# ${input.title}\n\n${sectionBody.replace(/^## /, "")}`;
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
    if (k === input.kind) sections.set(k, sectionBody);
    else {
      const prev = extractSection(existing, k);
      if (prev) sections.set(k, prev);
      else {
        try {
          const side = await readFile(path.join(dir, `${k}-report.md`), "utf8");
          sections.set(k, side.replace(/^# .+\n+/, "").trim());
        } catch {
          /* skip */
        }
      }
    }
  }

  const overallPass = KIND_ORDER.every((k) => {
    const body = sections.get(k);
    if (!body) return false;
    return (
      /^\s*-\s*\*\*结果\*\*:\s*PASS/m.test(body) ||
      /\*\*结果\*\*:\s*PASS/.test(body)
    );
  });
  const known = KIND_ORDER.filter((k) => sections.has(k));
  const statusLine =
    known.length === 0
      ? "尚未生成任何分项"
      : known
          .map((k) => {
            const body = sections.get(k)!;
            const pass = /\*\*结果\*\*:\s*PASS/.test(body);
            return `${k}:${pass ? "PASS" : "FAIL"}`;
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
    "",
    `> 本目录聚合 unit / eval / load / e2e 四份详细报表，便于复盘引用。`,
    "",
  ];
  for (const k of KIND_ORDER) {
    parts.push(sectionMarker(k));
    parts.push("");
    parts.push(`# ${KIND_TITLE[k]}`);
    parts.push("");
    if (sections.has(k)) {
      parts.push(sections.get(k)!);
    } else {
      parts.push(`_尚未生成（跑对应门禁后自动写入）_`);
      parts.push("");
    }
  }
  await writeFile(gatePath, parts.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");

  console.log(`[report] wrote ${mdPath}`);
  console.log(`[report] wrote ${jsonPath}`);
  console.log(`[report] updated ${gatePath}`);
  return { jsonPath, mdPath, gatePath };
};
