import type { AssistantMessageBlock, DbChatTurn } from "@fambrain/brain-types";
import { ENUMERATION_EXHAUSTIVE_PAGE_SIZE } from "@/agentflow/agents/online/corpus-lister/list";
import type { EnumerationControl, EnumerationListKind } from "./action-prompts";

type EnumerationBlock = Extract<AssistantMessageBlock, { type: "enumeration" }>;

/** blocks.listKind（employer）→ Intake enumerationControl.listKind（experience） */
export const enumerationBlockListKind = (
    listKind: EnumerationListKind
): EnumerationBlock["listKind"] =>
    listKind === "project" ? "project" : "employer";

/** 从 history 末向前找匹配 listKind 的 enumeration block */
export const findLastEnumerationBlock = (
    history: DbChatTurn[],
    listKind: EnumerationListKind
): EnumerationBlock | null => {
    const blockKind = enumerationBlockListKind(listKind);
    for (let i = history.length - 1; i >= 0; i--) {
        const turn = history[i];
        if (turn?.role !== "assistant" || !turn.blocks?.length) continue;
        const block = turn.blocks.find(
            (b): b is EnumerationBlock =>
                b.type === "enumeration" && b.listKind === blockKind
        );
        if (block) return block;
    }
    return null;
};

/** 按 enumerationControl + 上一轮 assistant blocks 解析 list 分页（无 Redis / 无开关） */
export const resolveEnumerationPagination = (
    control: EnumerationControl,
    history: DbChatTurn[],
    defaultPageSize: number = ENUMERATION_EXHAUSTIVE_PAGE_SIZE
): { page: number; pageSize: number } => {
    if (control.action === "exhaustive") {
        return { page: 1, pageSize: ENUMERATION_EXHAUSTIVE_PAGE_SIZE };
    }
    if (control.action === "continue") {
        const prior = findLastEnumerationBlock(history, control.listKind);
        if (prior) {
            return {
                page: prior.page + 1,
                pageSize: prior.pageSize,
            };
        }
        return { page: 1, pageSize: defaultPageSize };
    }
    return { page: 1, pageSize: defaultPageSize };
};
