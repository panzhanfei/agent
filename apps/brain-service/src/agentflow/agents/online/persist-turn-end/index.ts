/** PersistTurnEnd：在线 Pipeline 图末节点（LangGraph END 前）— LangMem + 可选静默用户记忆。 */

import { logAgentIn, logAgentOut } from "@fambrain/brain-shared/agent-log";
import { persistPipelineMemory } from "@fambrain/brain-memory";
import { isUserFactIntent } from "@/agentflow/agents/online/user-fact";
import { persistUserMemoryAutoLearnAfterTurn } from "@/agentflow/agents/online/user-memory-extract";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

/**
 * PersistTurnEnd：LangGraph END 前最后一个在线节点（非 LLM 图节点）。
 * 轮次结束后写 LangMem；可选独立 LLM 静默抽取 → Mem0。
 */
export const runPersistTurnEnd = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentIn("TurnEnd", "进入", {
    userQuestion: state.userQuestion,
    repeatQuestionHit: state.repeatQuestionHit,
    hasAnswer: Boolean(state.answer?.trim()),
    userFact: Boolean(state.decision?.userFact),
    turnAborted: state.turnAborted,
  });

  if (state.turnAborted) {
    logAgentOut("TurnEnd", "出去", { skipped: true, reason: "turn_aborted" });
    return {};
  }

  if (state.repeatQuestionHit) {
    logAgentOut("TurnEnd", "出去", {
      skipped: true,
      reason: "repeat_question_hit",
    });
    return {};
  }

  const answer = state.answer?.trim();
  if (!answer) {
    logAgentOut("TurnEnd", "出去", { skipped: true, reason: "empty_answer" });
    return {};
  }

  try {
    await persistPipelineMemory({
      context: state.context,
      history: state.history,
      userQuestion: state.userQuestion,
      answer,
    });

    const skipAutoLearn =
      Boolean(state.decision?.userFact) ||
      (state.decision ? isUserFactIntent(state.decision.intent) : false);

    const { wrote } = await persistUserMemoryAutoLearnAfterTurn({
      context: state.context,
      userQuestion: state.userQuestion,
      skipBecauseExplicitUserFact: skipAutoLearn,
    });

    logAgentOut("TurnEnd", "出去", {
      langMem: true,
      autoLearnWrote: wrote,
      autoLearnSkipped: skipAutoLearn,
    });
    return {};
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logAgentOut("TurnEnd", "出去", { error: message });
    return {};
  }
};
