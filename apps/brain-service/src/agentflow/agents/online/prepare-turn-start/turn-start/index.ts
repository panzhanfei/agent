/**
 * PrepareTurnStart：LangGraph START 后首节点（非 LLM）。
 * ALS 记事本应由 stream 入口挂好；此处仅兜底（单测 / 直调节点时）。
 */
import { logAgentIn, logAgentOut } from "@fambrain/brain-shared/agent-log";
import {
    createPipelineRunStore,
    pipelineRunStorage,
} from "@fambrain/brain-shared/pipeline-run-context";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

/** 兜底：stream 未挂 ALS 时再建一份（正常路径为 no-op） */
const ensurePipelineRunStore = (): void => {
    if (pipelineRunStorage.getStore()) return;
    pipelineRunStorage.enterWith(createPipelineRunStore());
};

export const runPrepareTurnStart = async (
    state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
    ensurePipelineRunStore();

    logAgentIn("TurnStart", "进入", {
        userQuestion: state.userQuestion,
        historyTurns: state.history.length,
        actorUserId: state.context.actorUserId,
        corpusUserId: state.context.corpusUserId,
        displayName: state.context.displayName,
        conversationId: state.context.conversationId,
    });

    const asOfDate = new Date().toISOString().slice(0, 10);
    logAgentOut("TurnStart", "出去", { alsReady: true, asOfDate });
    return { asOfDate };
};
