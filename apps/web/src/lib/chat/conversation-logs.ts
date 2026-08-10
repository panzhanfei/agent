import type {
    PipelineLogEntry,
    PipelineTiming,
    TurnStepEvent,
} from "@fambrain/brain-types";

export type { TurnStepEvent };

export type ConversationTurnLog = {
    turnId: string;
    userQuestion: string;
    startedAt: number;
    status: "running" | "done" | "error" | "cancelled" | "superseded";
    entries: PipelineLogEntry[];
    steps: TurnStepEvent[];
    timing?: PipelineTiming & { clientTotalMs?: number };
    error?: string;
};

export type ConversationLogBundle = {
    conversationId: string;
    turns: ConversationTurnLog[];
};

export const createTurnLog = (turnId: string, userQuestion: string): ConversationTurnLog => ({
    turnId,
    userQuestion,
    startedAt: Date.now(),
    status: "running",
    entries: [],
    steps: [],
});

export const upsertStep = (
    steps: TurnStepEvent[],
    event: TurnStepEvent
): TurnStepEvent[] => {
    const idx = steps.findIndex((s) => s.name === event.name);
    if (idx >= 0) {
        const next = [...steps];
        next[idx] = { ...next[idx], ...event };
        return next;
    }
    return [...steps, event];
};

export const formatTokenSummary = (timing?: PipelineTiming): string | null => {
    const tokens = timing?.tokens;
    if (!tokens || tokens.totalTokens <= 0)
        return null;
    const est = tokens.estimated ? "（估算）" : "";
    return `${tokens.totalTokens.toLocaleString()} tokens${est} · 输入 ${tokens.promptTokens.toLocaleString()} · 输出 ${tokens.completionTokens.toLocaleString()}`;
};

/** 按节点 token 分桶（供运行日志 / 气泡展开） */
export const formatTokenByNodeEntries = (
    timing?: PipelineTiming
): Array<{ name: string; prompt: number; completion: number; total: number }> => {
    const byNode = timing?.tokens?.byNode;
    if (!byNode) return [];
    return (Object.entries(byNode) as Array<
        [string, { prompt: number; completion: number }]
    >)
        .map(([name, v]) => ({
            name,
            prompt: v.prompt,
            completion: v.completion,
            total: v.prompt + v.completion,
        }))
        .filter((e) => e.total > 0)
        .sort((a, b) => b.total - a.total);
};

export const AGENT_LABELS: Record<string, string> = {
    Pipeline: "编排",
    TurnStart: "准备",
    TurnEnd: "写入",
    RepeatQuestionGuard: "同问短路",
    PreparePipelineMemory: "加载记忆",
    IntakeCoordinator: "入口",
    KnowledgeManager: "检索",
    FactChecker: "核查",
    ContentOrganizer: "整理",
    ContentSummarizer: "摘要",
    InformationAnalyst: "回答",
    Mem0: "记忆",
    UserFact: "用户事实",
    UserMemoryExtract: "静默记忆",
};
