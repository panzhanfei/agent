import type { CorpusDocKind } from "./interface";
import { CORPUS_DOC_KINDS } from "./interface";

const NAME_LABELS = ["姓名", "名字"] as const;
const EMPTY_CELL = /^[-—–/\s]*$/;

const isNameLabel = (cell: string): boolean =>
    NAME_LABELS.some((label) => cell.includes(label));

const parseTableCells = (line: string): string[] | null => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
    const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
    if (cells.length < 2) return null;
    return cells;
};

const isTableSeparator = (cells: string[]): boolean =>
    cells.every((c) => /^[-:]+$/.test(c));

const collectTables = (text: string): string[][][] => {
    const tables: string[][][] = [];
    let current: string[][] = [];
    for (const line of text.split(/\r?\n/)) {
        const cells = parseTableCells(line);
        if (cells && isTableSeparator(cells)) continue;
        if (cells) {
            current.push(cells);
            continue;
        }
        if (current.length > 0) {
            tables.push(current);
            current = [];
        }
    }
    if (current.length > 0) tables.push(current);
    return tables;
};

/** 整篇是否为多人姓名名册（语料表结构，非口语）。 */
export const isRelationsRosterBody = (text: string): boolean => {
    const tables = collectTables(text);
    let kvNameRows = 0;
    for (const table of tables) {
        const header = table[0];
        const nameCol = header?.findIndex(isNameLabel) ?? -1;
        if (nameCol >= 0 && table.length >= 2) {
            const dataRows = table.slice(1).filter((row) => {
                const value = row[nameCol]?.trim() ?? "";
                return value.length > 0 && !EMPTY_CELL.test(value);
            });
            if (dataRows.length >= 2) return true;
        }
        for (const row of table) {
            const label = row[0] ?? "";
            const value = row[1] ?? "";
            if (isNameLabel(label) && value && !EMPTY_CELL.test(value)) {
                kvNameRows += 1;
            }
        }
    }
    return kvNameRows >= 2;
};

export const parseCorpusDocKind = (raw: unknown): CorpusDocKind | undefined => {
    if (typeof raw !== "string") return undefined;
    return (CORPUS_DOC_KINDS as readonly string[]).includes(raw)
        ? (raw as CorpusDocKind)
        : undefined;
};

/**
 * 整篇类型：目录 schema 优先，personal/ 再用全文表结构区分档案 vs 名册。
 */
export const inferCorpusDocKind = (
    repoPath: string,
    fullBody = ""
): CorpusDocKind => {
    const p = repoPath.replace(/\\/g, "/").toLowerCase();
    if (p.includes("/experience/")) return "experience";
    if (p.includes("/projects/")) return "project";
    // vault 语料化 / 解析导入落在 personal/imports；learned 为历史静默学习。
    // 二者不是身份柜，勿打成 identity_card。
    if (p.includes("/personal/imports/") || p.includes("/learned/")) {
        return "uncategorized";
    }
    if (p.includes("/personal/")) {
        return isRelationsRosterBody(fullBody) ? "relations" : "identity_card";
    }
    return "uncategorized";
};
