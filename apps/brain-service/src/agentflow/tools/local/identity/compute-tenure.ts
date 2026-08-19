/**
 * 从工作经历时间线 excerpt 推算从业年限（确定性，无口语硬编码）。
 * 解析表格/行内「YYYY.MM - YYYY.MM|至今」日期段。
 * 槽 searchQuery 带雇主实体时匹配该区间（有结束日则止于结束日）；
 * 否则按总从业：最早起点 → asOf。
 */
import { IDENTITY_FIELD_SEARCH } from "@/agentflow/agents/online/intake-coordinator/composite";
import { IDENTITY_CORPUS_FIELD_LABELS } from "./corpus-labels";
import type { KnowledgeHit } from "@/agentflow/agents/online/knowledge-manager";
import type {
    TenureExtraction,
    TenureRange,
    TenureScope,
} from "./interface";

export type { TenureExtraction, TenureRange, TenureScope } from "./interface";

const RANGE_RE =
    /(\d{4})(?:[./年-](\d{1,2}))?\s*[-–—~至到]+\s*(?:(\d{4})(?:[./年-](\d{1,2}))?|至今|现在|present)/gi;

/** identityField=tenure 的检索模板词（schema→执行，不是用户口语停用词表） */
const tenureSchemaTemplateTokens = (): Set<string> => {
    const tokens = [
        ...IDENTITY_FIELD_SEARCH.tenure.searchQuery.split(/\s+/),
        ...IDENTITY_CORPUS_FIELD_LABELS.tenure,
    ];
    return new Set(
        tokens.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2)
    );
};

const rangeStartKey = (r: TenureRange): number =>
    r.startYear * 100 + (r.startMonth ?? 1);

const rangeEndKey = (r: TenureRange): number => {
    if (r.ongoing || r.endYear == null) return 999912;
    return r.endYear * 100 + (r.endMonth ?? 12);
};

const rangeDedupeKey = (r: TenureRange): string =>
    `${rangeStartKey(r)}-${rangeEndKey(r)}`;

export const parseTenureRangesFromText = (
    text: string,
    extraContext = "",
    sourceHit?: KnowledgeHit
): TenureRange[] => {
    const out: TenureRange[] = [];
    for (const line of text.split(/\r?\n/)) {
        RANGE_RE.lastIndex = 0;
        for (const m of line.matchAll(RANGE_RE)) {
            const startYear = Number(m[1]);
            if (!Number.isFinite(startYear) || startYear < 1970 || startYear > 2100) {
                continue;
            }
            const startMonth = m[2] ? Number(m[2]) : undefined;
            const endRaw = m[3];
            const ongoing = !endRaw;
            const endYear = endRaw ? Number(endRaw) : undefined;
            const endMonth = m[4] ? Number(m[4]) : undefined;
            out.push({
                startYear,
                startMonth:
                    startMonth && startMonth >= 1 && startMonth <= 12
                        ? startMonth
                        : undefined,
                endYear,
                endMonth:
                    endMonth && endMonth >= 1 && endMonth <= 12
                        ? endMonth
                        : undefined,
                ongoing,
                context: `${extraContext} ${line}`.trim(),
                sourceHit,
            });
        }
    }
    return out;
};

/** 语料 experience 路径惯例：`experience/2016-公司.md` → 起点年 */
const rangesFromPath = (
    path: string,
    extraContext: string,
    sourceHit?: KnowledgeHit
): TenureRange[] => {
    const base = path.split("/").pop() ?? path;
    const m = base.match(/^(20\d{2})[-_]/);
    if (!m) return [];
    const startYear = Number(m[1]);
    if (!Number.isFinite(startYear)) return [];
    return [
        {
            startYear,
            ongoing: false,
            context: `${extraContext} ${path} ${base}`.trim(),
            sourceHit,
        },
    ];
};

export const extractTenureFromHits = (
    hits: KnowledgeHit[]
): TenureExtraction | null => {
    const sorted = [...hits].sort((a, b) => {
        const score = (p: string) =>
            /personal|简历|resume|experience|经历/i.test(p) ? 0 : 1;
        return score(a.path) - score(b.path);
    });
    const allRanges: TenureRange[] = [];
    let sourceHit: KnowledgeHit | undefined;
    for (const hit of sorted) {
        const extra = `${hit.path} ${hit.title ?? ""}`;
        const fromText = parseTenureRangesFromText(hit.excerpt, extra, hit);
        const fromPath = /experience/i.test(hit.path)
            ? rangesFromPath(hit.path, extra, hit)
            : [];
        const ranges = [...fromText, ...fromPath];
        if (ranges.length === 0) continue;
        if (!sourceHit || fromText.length > 0) sourceHit = hit;
        allRanges.push(...ranges);
    }
    if (allRanges.length === 0) return null;
    const earliest = [...allRanges].sort(
        (a, b) => rangeStartKey(a) - rangeStartKey(b)
    )[0]!;
    return {
        earliest,
        ranges: allRanges,
        sourceHit,
    };
};

/**
 * 从 Intake searchQuery 空白分词中去掉 tenure 检索模板，剩余即雇主实体。
 * 不剥 label 口语（上班/多久/几年等）。
 */
export const extractTenureEntityHints = (searchQuery: string): string[] => {
    const template = tenureSchemaTemplateTokens();
    const hints: string[] = [];
    const seen = new Set<string>();
    for (const raw of searchQuery.split(/\s+/)) {
        const t = raw.trim();
        if (t.length < 2) continue;
        const key = t.toLowerCase();
        if (template.has(key) || seen.has(key)) continue;
        seen.add(key);
        hints.push(t);
    }
    return hints.sort((a, b) => b.length - a.length);
};

const rangeHintScore = (range: TenureRange, hints: string[]): number => {
    const hay = (range.context ?? "").toLowerCase();
    if (!hay) return 0;
    let best = 0;
    for (const h of hints) {
        const n = h.toLowerCase();
        if (n.length < 2) continue;
        if (hay.includes(n)) best = Math.max(best, n.length);
    }
    return best;
};

export const tenureEndDate = (range: TenureRange, asOf: Date): Date => {
    if (range.ongoing || range.endYear == null) return asOf;
    const month = range.endMonth ?? 12;
    return new Date(range.endYear, month - 1, 1);
};

export const computeTenureYearsMonths = (
    start: TenureRange,
    end: Date
): { years: number; months: number } => {
    const startMonth = start.startMonth ?? 1;
    let years = end.getFullYear() - start.startYear;
    let months = end.getMonth() + 1 - startMonth;
    if (months < 0) {
        years -= 1;
        months += 12;
    }
    if (years < 0) return { years: 0, months: 0 };
    return { years, months };
};

const addDuration = (
    a: { years: number; months: number },
    b: { years: number; months: number }
): { years: number; months: number } => {
    let months = a.months + b.months;
    let years = a.years + b.years + Math.floor(months / 12);
    months = months % 12;
    return { years, months };
};

export type TenureSelection = {
    ranges: TenureRange[];
    scope: TenureScope;
    duration: { years: number; months: number };
    sourceHit?: KnowledgeHit;
};

export const selectTenureRanges = (
    extraction: TenureExtraction,
    searchQuery: string,
    asOf: Date
): TenureSelection => {
    const hints = extractTenureEntityHints(searchQuery);
    if (hints.length > 0) {
        let bestScore = 0;
        const scored = extraction.ranges.map((r) => {
            const score = rangeHintScore(r, hints);
            if (score > bestScore) bestScore = score;
            return { r, score };
        });
        if (bestScore > 0) {
            const matched = scored
                .filter((s) => s.score === bestScore)
                .map((s) => s.r);
            const byStartYear = new Map<number, TenureRange[]>();
            for (const r of matched) {
                const list = byStartYear.get(r.startYear) ?? [];
                list.push(r);
                byStartYear.set(r.startYear, list);
            }
            const uniq = new Map<string, TenureRange>();
            for (const group of byStartYear.values()) {
                const withDates = group.filter(
                    (r) => r.endYear != null || r.ongoing || r.startMonth != null
                );
                const chosen = withDates.length > 0 ? withDates : group;
                for (const r of chosen) {
                    const k = rangeDedupeKey(r);
                    const prev = uniq.get(k);
                    if (!prev || (r.endYear != null && prev.endYear == null)) {
                        uniq.set(k, r);
                    }
                }
            }
            const ranges = [...uniq.values()].sort(
                (a, b) => rangeStartKey(a) - rangeStartKey(b)
            );
            let duration = { years: 0, months: 0 };
            for (const r of ranges) {
                duration = addDuration(
                    duration,
                    computeTenureYearsMonths(r, tenureEndDate(r, asOf))
                );
            }
            return {
                ranges,
                scope: "employer",
                duration,
                sourceHit: ranges[0]?.sourceHit ?? extraction.sourceHit,
            };
        }
    }
    return {
        ranges: [extraction.earliest],
        scope: "career",
        duration: computeTenureYearsMonths(extraction.earliest, asOf),
        sourceHit: extraction.earliest.sourceHit ?? extraction.sourceHit,
    };
};

const formatYm = (
    year: number,
    month: number | undefined,
    language: "zh" | "en" | "mixed"
): string => {
    if (language === "en") {
        return month != null ? `${year}-${String(month).padStart(2, "0")}` : `${year}`;
    }
    return month != null ? `${year} 年 ${month} 月` : `${year} 年`;
};

const formatRangeSpan = (
    range: TenureRange,
    language: "zh" | "en" | "mixed"
): string => {
    const start = formatYm(range.startYear, range.startMonth, language);
    if (range.ongoing || range.endYear == null) {
        return language === "en" ? `${start}–present` : `${start}至今`;
    }
    const end = formatYm(range.endYear, range.endMonth, language);
    return language === "en" ? `${start}–${end}` : `${start} 至 ${end}`;
};

const formatDuration = (
    years: number,
    months: number,
    language: "zh" | "en" | "mixed"
): string => {
    if (language === "en") {
        return months > 0 ? `${years} years ${months} months` : `${years} years`;
    }
    return months > 0 ? `${years} 年 ${months} 个月` : `${years} 年`;
};

const asOfSuffix = (
    asOfDate: string | undefined,
    language: "zh" | "en" | "mixed"
): string => {
    if (!asOfDate) return "";
    return language === "en" ? ` as of ${asOfDate}` : `；截至 ${asOfDate}`;
};

export const buildTenureAnswer = (input: {
    extraction: TenureExtraction | null;
    language: "zh" | "en" | "mixed";
    asOfDate?: string;
    /** Intake 槽 searchQuery；含雇主实体则匹配该公司区间 */
    searchQuery?: string;
}): { answer: string; insufficientEvidence: boolean } => {
    const { extraction, language } = input;
    if (!extraction) {
        return {
            answer:
                language === "en"
                    ? "No work-history date ranges were found in the resume excerpts, so years of experience cannot be computed."
                    : "个人知识库简历片段中未解析到工作经历时间段，无法推算从业年限。",
            insufficientEvidence: true,
        };
    }
    const asOf = input.asOfDate
        ? new Date(`${input.asOfDate}T12:00:00`)
        : new Date();
    const selected = selectTenureRanges(
        extraction,
        input.searchQuery ?? "",
        asOf
    );
    const dur = formatDuration(
        selected.duration.years,
        selected.duration.months,
        language
    );
    const suffix = asOfSuffix(input.asOfDate, language);
    if (selected.scope === "employer") {
        const span = selected.ranges
            .map((r) => formatRangeSpan(r, language))
            .join(language === "en" ? "; " : "、");
        if (language === "en") {
            return {
                answer: `${dur} (employment ${span}${suffix})`,
                insufficientEvidence: false,
            };
        }
        return {
            answer: `${dur}（任职 ${span}${suffix}）`,
            insufficientEvidence: false,
        };
    }
    const startLabel = formatYm(
        extraction.earliest.startYear,
        extraction.earliest.startMonth,
        language
    );
    if (language === "en") {
        return {
            answer: `${dur} (earliest resume work history from ${startLabel}${suffix})`,
            insufficientEvidence: false,
        };
    }
    return {
        answer: `${dur}（简历工作经历最早自 ${startLabel}${suffix}）`,
        insufficientEvidence: false,
    };
};
