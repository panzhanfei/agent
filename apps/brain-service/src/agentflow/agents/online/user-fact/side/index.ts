/**
 * userFactSide：同轮 remember side-effect（与检索并行）。
 * 不 exitEarly；确认文案写入 sideEffectAnswer，由 planMerge / Analyst 并入终稿。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { addStructuredUserFact } from "@fambrain/brain-memory";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import {
  buildRememberConfirmAnswer,
  buildRememberMissingValueAnswer,
  coalesceRememberValue,
  routeUserFactSideEffect,
  validateFactValue,
} from "../user-fact";

export const runUserFactSideNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const language = state.decision?.language ?? "zh";
  const userFact = state.decision
    ? routeUserFactSideEffect(state.decision)
    : null;

  if (!userFact || userFact.action !== "remember") {
    return { sideEffectAnswer: null };
  }

  logAgentOut("UserFactSide", "进入", {
    factKey: userFact.factKey,
    label: userFact.label,
    hasValue: Boolean(userFact.value),
  });

  try {
    const raw =
      coalesceRememberValue(userFact, state.userQuestion, state.history) ??
      null;
    const value = raw ? validateFactValue(raw) : null;

    if (!value) {
      const answer = buildRememberMissingValueAnswer(userFact.label, language);
      logAgentOut("UserFactSide", "出去", {
        ok: false,
        reason: "missing_value",
      });
      return { sideEffectAnswer: answer };
    }

    await addStructuredUserFact({
      userId: state.context.actorUserId,
      factKey: userFact.factKey,
      label: userFact.label,
      value,
    });

    const answer = buildRememberConfirmAnswer(
      userFact.label,
      value,
      language
    );
    logAgentOut("UserFactSide", "出去", {
      ok: true,
      valuePreview: value,
    });
    return { sideEffectAnswer: answer };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logAgentOut("UserFactSide", "出去", { ok: false, error: message });
    return {
      sideEffectAnswer:
        language === "en"
          ? "Failed to save contact info. Please try again."
          : "保存联系方式时出错，请稍后重试。",
      error: message,
    };
  }
};
