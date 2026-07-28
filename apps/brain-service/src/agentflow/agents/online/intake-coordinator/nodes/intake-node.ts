import { completeIntakeCoordinator } from "../llm/ollama-chat";
import {
  matchUiEnumerationPrompt,
  resolveEnumerationPagination,
} from "@/agentflow/agents/online/corpus-lister/enumeration";
import {
  buildEnumerationListDecision,
  buildIncompleteUtteranceDecision,
  buildPureChitchatDecision,
  applyIntakeChitchatGuard,
} from "@/agentflow/agents/online/intake-coordinator/guards";
import {
  isPureSocialUtterance,
  normalizeIntakeUtterance,
  rewriteLastUserTurn,
  shouldRetryCoreferenceMerge,
  shouldShortCircuitIncompleteUtterance,
} from "@/agentflow/agents/online/intake-coordinator/signals";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { buildEarlyExitRoutedDecision } from "../pipeline/intake-pipeline";
import { parseIntakeDecision } from "../pipeline/parse-intake";
import { runIntakePipeline } from "../pipeline/intake-pipeline";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

/**
 * LangGraph `intake` 节点（位于 preparePipelineMemory 之后、routeAfterIntake 之前）。
 *
 * 职责：在调 pipeline 之前完成「能不调 LLM 就不调」的短路，以及 LLM 侧的格式/指代补救；
 * pipeline（runIntakePipeline）只负责 parse → early-exit → legalize PathPlan → derive slots。
 *
 * 执行顺序概览：
 *   0a  纯社交（你好/谢谢）→ chitchat 早退，不调 LLM
 *   0a2 单字残缺（嗯/好/无上文单字）→ clarify 早退
 *   0b  UI 列举按钮 exact-match → 直接 buildEnumerationListDecision，不调 LLM
 *   1   normalize 问句 → 首次 LLM（输出 pathPlan + answerOrder JSON）
 *   1a  非 JSON → 格式修复 prompt 再调 1 次（仍不触发指代拼接）
 *   1b  JSON 且 coreference=unresolved → 拼接「上轮；本轮」再调 1 次
 *   2   runIntakePipeline：合法化、补 list 页码、派生 compositeSlots → state.decision
 */
export const runIntakeNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  try {
    /** Web/API 注入的原始问句；UI 按钮文案必须保留原文用于 exact-match */
    const rawQuestion = state.userQuestion;

    /**
     * 进线 normalize：trim + 压连续重复码点（「呢呢呢？」→「呢？」）。
     * 仅用于 token 节省与单字判定；不做 NFKC，避免与 history 对不上。
     */
    const normalizedQuestion =
      normalizeIntakeUtterance(rawQuestion) || rawQuestion.trim() || rawQuestion;

    /**
     * 【短路 0a】纯社交寒暄。
     * 原文或 normalize 后命中「你好/谢谢/…」词表 → 固定 chitchat briefReply。
     * 比 pipeline 里的 chitchat guard 更早，避免无意义 LLM 调用。
     */
    if (
      isPureSocialUtterance(normalizedQuestion) ||
      isPureSocialUtterance(rawQuestion)
    ) {
      const chitchat = applyIntakeChitchatGuard(buildPureChitchatDecision());
      return {
        decision: buildEarlyExitRoutedDecision(chitchat),
      };
    }

    /**
     * 【短路 0a2】单字/残缺 utterance。
     * 例如「嗯」「好」或无上轮实质问的单字 → clarify 反问，不调 LLM。
     * 判定在 normalize + 去首尾标点后进行（「呢？？」按单字「呢」处理）。
     */
    if (
      shouldShortCircuitIncompleteUtterance(
        normalizedQuestion,
        state.intakeHistory
      )
    ) {
      const incomplete = buildIncompleteUtteranceDecision();
      logAgentOut("IntakeCoordinator", "短路_单字残缺", {
        userQuestion: rawQuestion,
        normalizedQuestion,
      });
      return {
        decision: buildEarlyExitRoutedDecision(incomplete),
      };
    }

    /**
     * 【短路 0b】Web UI 列举按钮（「更多项目」「列出全部」等）。
     * 续页从 history 末条 assistant enumeration block 读 page/pageSize。
     */
    const uiControl = matchUiEnumerationPrompt(rawQuestion);
    if (
      uiControl &&
      (uiControl.action === "continue" || uiControl.action === "exhaustive")
    ) {
      const { page, pageSize } = resolveEnumerationPagination(
        uiControl,
        state.history
      );
      return {
        decision: buildEnumerationListDecision({
          userQuestion: rawQuestion,
          listKind: uiControl.listKind,
          listIntent:
            uiControl.action === "continue" ? "continue" : "exhaustive",
          page,
          pageSize,
        }),
      };
    }

    /**
     * 【步骤 1】首次 Intake LLM。
     * effectiveQuestion：送入 pipeline 的检索主问句（可能被 1b 拼接改写）。
     * 若 normalize 改变了末轮 user 内容，同步 rewrite history，避免 LLM 看到重复字。
     */
    let effectiveQuestion = normalizedQuestion;
    let intakeHistoryForLlm =
      normalizedQuestion !== rawQuestion.trim()
        ? rewriteLastUserTurn(state.intakeHistory, normalizedQuestion)
        : state.intakeHistory;

    let intakeRaw = await completeIntakeCoordinator(intakeHistoryForLlm, {
      memoryBlock: state.memoryBlock,
      intakeHistory: intakeHistoryForLlm,
    });

    /**
     * 【步骤 1a】JSON 格式修复（最多 1 次）。
     * 只 peek parseIntakeDecision，不进入 pipeline。
     * 模型输出散文/夹带 markdown 时，用 jsonFormatRepair prompt 重试。
     * 注意：peek=null 时不走 1b 指代拼接，交给 pipeline 的散文 clarify / default 兜底。
     */
    let peek = parseIntakeDecision(intakeRaw);
    if (!peek) {
      logAgentOut("IntakeCoordinator", "JSON格式修复重试", {
        userQuestion: effectiveQuestion,
        rawPreview:
          intakeRaw.length > 200 ? `${intakeRaw.slice(0, 200)}…` : intakeRaw,
      });
      intakeRaw = await completeIntakeCoordinator(intakeHistoryForLlm, {
        memoryBlock: state.memoryBlock,
        intakeHistory: intakeHistoryForLlm,
        jsonFormatRepair: true,
      });
      peek = parseIntakeDecision(intakeRaw);
    }

    /**
     * 【步骤 1b】指代拼接重试（最多 1 次，仅 coreference=unresolved）。
     *
     * 唯一触发条件：peek.coreference === "unresolved" 且有 prior。
     * 代码不根据 intent / pathPlan / 句长猜测；LLM 须正确标注 coreference。
     * pipeline 内 continuation guard 恒 noop。
     */
    const mergeRetry = shouldRetryCoreferenceMerge(
      peek,
      effectiveQuestion,
      state.intakeHistory
    );
    if (mergeRetry.retry && mergeRetry.mergedQuestion) {
      effectiveQuestion = mergeRetry.mergedQuestion;
      intakeHistoryForLlm = rewriteLastUserTurn(
        state.intakeHistory,
        effectiveQuestion
      );
      logAgentOut("IntakeCoordinator", "指代拼接重试", {
        original: rawQuestion,
        normalizedQuestion,
        prior: mergeRetry.prior,
        effectiveQuestion,
        peekCoreference: peek?.coreference ?? null,
        peekIntent: peek?.intent ?? null,
      });
      intakeRaw = await completeIntakeCoordinator(intakeHistoryForLlm, {
        memoryBlock: state.memoryBlock,
        intakeHistory: intakeHistoryForLlm,
        coreferenceMergeRetry: true,
      });
    }

    /**
     * 【步骤 2】pipeline 规则链（LLM 之后）。
     * parse → clarify/chitchat/userFact 早退 → link harmonize →
     * legalizePathPlan → fillListPages → derive compositeSlots / retrievalPlan / executionPlan。
     * 出口 decision 写入 state，由 routeAfterIntake 分流 planFanOut / listRetriever / respondEarly 等。
     */
    const { decision } = await runIntakePipeline({
      intakeRaw,
      userQuestion: effectiveQuestion,
      intakeHistory: intakeHistoryForLlm,
      history: state.history,
    });
    return { decision };
  } catch (e) {
    /** Ollama 不可用或超时：带 exitEarly，图路由到 respondEarly 展示友好错误 */
    const msg =
      e instanceof Error ? e.message : "入口接线员调用失败，请确认 Ollama 可用";
    return {
      error: msg,
      answer: "（模型调用失败：请确认本地 Ollama 已启动且模型已拉取）",
      exitEarly: true,
    };
  }
};
