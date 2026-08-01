import { mkdir } from "node:fs/promises";
import path from "node:path";
import { logAgentIn, logAgentOut } from "@fambrain/brain-shared/agent-log";
import { Memory } from "mem0ai/oss";
import { getMemoryConfig } from "../config";
type Mem0SearchHit = {
    memory?: string;
    text?: string;
};
let client: Memory | null = null;
const ensureClient = async (): Promise<Memory | null> => {
    const cfg = getMemoryConfig();
    if (!cfg.mem0Enabled)
        return null;
    if (!client) {
        await mkdir(path.dirname(cfg.mem0HistoryDbPath), { recursive: true });
        client = new Memory({
            llm: {
                provider: "ollama",
                config: {
                    model: cfg.ollamaChatModel,
                    url: cfg.ollamaBaseUrl,
                },
            },
            embedder: {
                provider: "ollama",
                config: {
                    model: cfg.ollamaEmbedModel,
                    url: cfg.ollamaBaseUrl,
                    embeddingDims: 768,
                },
            },
            vectorStore: {
                provider: "memory",
                config: {
                    collectionName: "fambrain_user_memories",
                    dimension: 768,
                },
            },
            historyDbPath: cfg.mem0HistoryDbPath,
        });
    }
    return client;
};
const extractMemoryTexts = (payload: unknown): string[] => {
    if (!payload || typeof payload !== "object")
        return [];
    const root = payload as {
        results?: Mem0SearchHit[];
        memories?: Mem0SearchHit[];
    };
    const rows = root.results ?? root.memories ?? [];
    if (!Array.isArray(rows))
        return [];
    return rows
        .map((row) => {
        const text = row.memory ?? row.text;
        return typeof text === "string" ? text.trim() : "";
    })
        .filter((s) => s.length > 0);
};
export const searchUserMemories = async (userId: string, query: string): Promise<string[]> => {
    const cfg = getMemoryConfig();
    if (!cfg.mem0Enabled) {
        logAgentOut("Mem0", "出去", { action: "search", skipped: true, reason: "MEM0_ENABLED=false", userId, query });
        return [];
    }
    const memory = await ensureClient();
    if (!memory)
        return [];
    logAgentIn("Mem0", "进入", {
        action: "search",
        userId,
        query,
        limit: cfg.mem0SearchLimit,
    });
    try {
        const raw = await memory.search(query, {
            userId,
            limit: cfg.mem0SearchLimit,
        });
        const texts = extractMemoryTexts(raw);
        logAgentOut("Mem0", "出去", {
            action: "search",
            userId,
            query,
            extractedCount: texts.length,
            extracted: texts,
        });
        return texts;
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("[Mem0] search failed:", message);
        logAgentOut("Mem0", "出去", { action: "search", userId, query, error: message, extractedCount: 0 });
        return [];
    }
};
/** P0-16：用户口述联系方式等，显式写入（不依赖轮次后 LLM 抽取） */
export const addExplicitUserMemory = async (
    userId: string,
    memoryText: string,
    metadata?: Record<string, string>
): Promise<void> => {
    const cfg = getMemoryConfig();
    const trimmed = memoryText.trim();
    if (!trimmed) return;
    if (!cfg.mem0Enabled) {
        logAgentOut("Mem0", "出去", {
            action: "add_explicit",
            skipped: true,
            reason: "MEM0_ENABLED=false",
            userId,
        });
        return;
    }
    const memory = await ensureClient();
    if (!memory) return;
    logAgentIn("Mem0", "进入", {
        action: "add_explicit",
        userId,
        memoryText: trimmed,
        metadata,
    });
    try {
        await memory.add(trimmed, {
            userId,
            metadata: { source: "explicit_remember", ...metadata },
        });
        logAgentOut("Mem0", "出去", { action: "add_explicit", userId, ok: true });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("[Mem0] add_explicit failed:", message);
        logAgentOut("Mem0", "出去", {
            action: "add_explicit",
            userId,
            ok: false,
            error: message,
        });
        throw e;
    }
};

/** 结构化 value 归一（trim + 空白折叠；不猜语义） */
export const normalizeStructuredFactValue = (value: string): string =>
    value.trim().replace(/\s+/g, " ");

type StructuredFactHit = { id: string; value: string };

/** 按 metadata.factKey（及文本标记兜底）找已有结构化事实 */
const listStructuredFactsForKey = async (
    memory: Memory,
    userId: string,
    factKey: string
): Promise<StructuredFactHit[]> => {
    const key = factKey.trim();
    if (!key) return [];
    const queries = [`user_fact ${key}`, key, `字段 ${key}`];
    const byId = new Map<string, string>();
    for (const query of queries) {
        try {
            const raw = await memory.search(query, { userId, limit: 20 });
            for (const item of raw.results ?? []) {
                if (!item?.id) continue;
                const meta = item.metadata ?? {};
                const metaKey =
                    typeof meta.factKey === "string" ? meta.factKey.trim() : "";
                const metaVal =
                    typeof meta.value === "string"
                        ? normalizeStructuredFactValue(meta.value)
                        : "";
                if (metaKey === key && metaVal) {
                    byId.set(item.id, metaVal);
                    continue;
                }
                const text = (item.memory ?? "").trim();
                if (
                    text.includes(`（字段 ${key}）`) ||
                    text.includes(`(字段 ${key})`)
                ) {
                    if (metaVal) {
                        byId.set(item.id, metaVal);
                    }
                }
            }
        } catch {
            /* 单次 search 失败不影响其余 query */
        }
    }
    return [...byId.entries()].map(([id, value]) => ({ id, value }));
};

export type AddStructuredUserFactResult =
    | "disabled"
    | "skipped"
    | "replaced"
    | "added";

/**
 * P0-16 / 阶段 5：结构化 user_fact 写入 Mem0。
 * 写时去重：同 factKey 同值 skip；同 key 异值先删旧再写。
 */
export const addStructuredUserFact = async (input: {
    userId: string;
    factKey: string;
    label: string;
    value: string;
    /** 写入来源：显式 remember 或轮次静默自学 */
    source?: "explicit_remember" | "auto_learn";
}): Promise<AddStructuredUserFactResult> => {
    const cfg = getMemoryConfig();
    if (!cfg.mem0Enabled) {
        logAgentOut("Mem0", "出去", {
            action: "add_structured",
            skipped: true,
            reason: "MEM0_ENABLED=false",
            userId: input.userId,
        });
        return "disabled";
    }
    const memory = await ensureClient();
    if (!memory) return "disabled";

    const factKey = input.factKey.trim();
    const label = input.label.trim() || factKey;
    const value = normalizeStructuredFactValue(input.value);
    if (!factKey || !value) return "skipped";

    const existing = await listStructuredFactsForKey(
        memory,
        input.userId,
        factKey
    );
    const sameValue = existing.filter((h) => h.value === value);
    const different = existing.filter((h) => h.value !== value);

    if (sameValue.length > 0 && different.length === 0) {
        logAgentOut("Mem0", "出去", {
            action: "add_structured",
            userId: input.userId,
            factKey,
            dedupe: "skipped_same_value",
            existingCount: sameValue.length,
        });
        return "skipped";
    }

    logAgentIn("Mem0", "进入", {
        action: "add_structured",
        userId: input.userId,
        factKey,
        label,
        value,
        existingCount: existing.length,
        replaceCount: different.length,
    });

    try {
        for (const hit of different) {
            await memory.delete(hit.id);
        }
        // 同值多条冗余时只保留一条语义：删多余后若已有同值则不再 add
        if (sameValue.length > 0) {
            for (const hit of sameValue.slice(1)) {
                await memory.delete(hit.id);
            }
            logAgentOut("Mem0", "出去", {
                action: "add_structured",
                userId: input.userId,
                ok: true,
                dedupe: different.length > 0 ? "replaced_then_kept" : "skipped_same_value",
            });
            return different.length > 0 ? "replaced" : "skipped";
        }

        const content = `${label}：${value}`;
        await memory.add(
            [
                {
                    role: "user",
                    content: `请记住我的${content}（字段 ${factKey}）`,
                },
            ],
            {
                userId: input.userId,
                metadata: {
                    type: "user_fact",
                    source: input.source ?? "explicit_remember",
                    factKey,
                    label,
                    value,
                },
            }
        );
        const result: AddStructuredUserFactResult =
            different.length > 0 ? "replaced" : "added";
        logAgentOut("Mem0", "出去", {
            action: "add_structured",
            userId: input.userId,
            ok: true,
            dedupe: result,
        });
        return result;
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("[Mem0] add_structured failed:", message);
        logAgentOut("Mem0", "出去", {
            action: "add_structured",
            userId: input.userId,
            ok: false,
            error: message,
        });
        throw e;
    }
};

const uniqueQueries = (parts: Array<string | null | undefined>): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of parts) {
        const q = p?.trim();
        if (!q || seen.has(q)) continue;
        seen.add(q);
        out.push(q);
    }
    return out;
};

/** 按 factKey + label + 用户问句语义检索（无固定词表） */
export const searchUserFactMemories = async (
    userId: string,
    factKey: string,
    factLabel: string,
    userQuestion: string
): Promise<string[]> => {
    const queries = uniqueQueries([
        userQuestion,
        factLabel,
        `${factLabel} ${factKey}`,
        `user_fact ${factKey}`,
    ]);
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const query of queries) {
        for (const text of await searchUserMemories(userId, query)) {
            if (!seen.has(text)) {
                seen.add(text);
                merged.push(text);
            }
        }
    }
    return merged;
};
