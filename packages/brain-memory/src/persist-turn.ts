import type { AgentPipelineContext, DbChatTurn } from "@fambrain/brain-types";
import { getMemoryConfig } from "./config";
import { persistSessionSummary } from "./langmem";

/** 轮次结束只写 LangMem 会话摘要。Mem0 仅走结构化 remember / 静默 auto-learn。 */
export const persistPipelineMemory = async (input: {
    context: AgentPipelineContext;
    history: DbChatTurn[];
    userQuestion: string;
    answer: string;
}): Promise<void> => {
    const cfg = getMemoryConfig();
    const trimmed = input.answer.trim();
    if (!trimmed) return;
    if (cfg.langMemEnabled && input.context.conversationId) {
        await persistSessionSummary(
            input.context.conversationId,
            input.history,
            trimmed
        );
    }
};
