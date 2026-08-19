import type { DbChatTurn } from "@fambrain/brain-types";
import {
    getConversationSessionSummary,
    upsertConversationSessionSummary,
} from "@fambrain/db";
import { completeChat } from "@fambrain/brain-shared/chat";
import { recordCompleteChatUsage } from "@fambrain/brain-shared/pipeline-run-context";
import { getMemoryConfig } from "../config";

/**
 * LangMem 在官方仅有 Python SDK；此处用 completeChat 会话摘要实现同等职责：
 * 长对话压缩为 summary，Intake / Analyst 注入摘要 + 保留最近 N 轮原文。
 * 摘要落 Prisma Conversation（sessionSummary），非 JSON 文件。
 * Chat 提供方跟 CHAT_PROVIDER（ollama | openai），不单独钉 Ollama。
 */
const SUMMARY_SYSTEM = `你是 FamBrain 的会话记忆管理器（LangMem 风格）。
将对话历史压缩为简洁中文摘要，保留：用户身份/偏好、已讨论的项目或话题、关键结论、待澄清点。
不要编造；只写对话中出现过的事实。输出纯文本，不要 JSON。`;

const formatTurns = (turns: DbChatTurn[]): string => {
    return turns
        .map((t) => `${t.role === "user" ? "用户" : "助手"}：${t.content}`)
        .join("\n");
};

export const loadSessionSummary = async (
    conversationId: string
): Promise<string | null> => {
    const cfg = getMemoryConfig();
    if (!cfg.langMemEnabled || !conversationId) return null;
    try {
        return await getConversationSessionSummary(conversationId);
    } catch (e) {
        console.warn(
            "[LangMem] load failed:",
            e instanceof Error ? e.message : String(e)
        );
        return null;
    }
};

export const trimHistoryForIntake = (history: DbChatTurn[]): DbChatTurn[] => {
    const cfg = getMemoryConfig();
    if (!cfg.langMemEnabled) {
        return history.length > 40 ? history.slice(-40) : history;
    }
    const keep = cfg.langMemKeepRecentTurns * 2;
    return history.length > keep ? history.slice(-keep) : history;
};

export const summarizeSessionTurns = async (
    previousSummary: string | null,
    turns: DbChatTurn[]
): Promise<string> => {
    const body = [
        previousSummary
            ? `已有会话摘要：\n${previousSummary}\n\n请合并以下新对话：`
            : "请摘要以下对话：",
        formatTurns(turns),
    ].join("\n\n");
    const result = await completeChat({
        messages: [
            { role: "system", content: SUMMARY_SYSTEM },
            { role: "user", content: body },
        ],
        jsonMode: false,
        thinking: "disabled",
        temperature: 0.2,
    });
    recordCompleteChatUsage(result.usage, {
        promptText: `${SUMMARY_SYSTEM}\n${body}`,
        completionText: result.text,
        node: "persist_turn_end",
    });
    return result.text || previousSummary || "";
};

export const persistSessionSummary = async (
    conversationId: string,
    history: DbChatTurn[],
    assistantAnswer: string
): Promise<void> => {
    const cfg = getMemoryConfig();
    if (!cfg.langMemEnabled || !conversationId) return;
    const turnCount = history.length + 1;
    if (turnCount < cfg.langMemSummarizeAfterTurns) return;
    try {
        const previous = await loadSessionSummary(conversationId);
        const fullTurns: DbChatTurn[] = [
            ...history,
            { role: "assistant", content: assistantAnswer },
        ];
        const olderCount = Math.max(
            0,
            fullTurns.length - cfg.langMemKeepRecentTurns * 2
        );
        const toSummarize = fullTurns.slice(0, olderCount);
        if (toSummarize.length === 0 && previous) return;
        const summary = await summarizeSessionTurns(previous, toSummarize);
        if (!summary) return;
        const ok = await upsertConversationSessionSummary(
            conversationId,
            summary
        );
        if (!ok) {
            console.warn(
                "[LangMem] persist skipped: conversation not found",
                conversationId
            );
        }
    } catch (e) {
        console.warn(
            "[LangMem] persist failed:",
            e instanceof Error ? e.message : String(e)
        );
    }
};
