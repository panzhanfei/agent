import { getWriter } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  prependSideEffectAssistantBlocks,
  sideEffectAnswerToAssistantBlock,
} from "@/agentflow/agents/online/user-fact";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
/**
 * InformationAnalyst：终稿回答。包根只聚合；流式在 stream/，归纳在 analyze/，列举拼装在 compose/。
 */
import { streamAnalyzeInformation } from "./stream";

export type {
  Citation,
  InformationAnalystInput,
  InformationAnalystResult,
} from "./interface";
export { prompt } from "./contract";
export {
  citationSchema,
  informationAnalystResultSchema,
  parseAnalystResult,
} from "./contract";
export {
  buildFallbackAnswer,
  buildSubQuestionFallbackAnswer,
  formatHitsAsAnswerList,
  formatSubQuestionSection,
  mergeSubQuestionAnswers,
  normalizeAnalystResult,
  shouldSkipAnalystLlm,
  toSubQuestionInput,
  type SubQuestionAnalyzeInput,
} from "./analyze";
export {
  prefersPlainTextAnalystStream,
  resolveAnalystQueryProfile,
} from "./limits";
export {
  pickToolResultForSubQuestion,
  toolRunToAnalystResult,
  type PickToolResultInput,
} from "./pick-tool-result";
export {
  composeEnumerationAnswer,
  mergeCompositeWithBlocks,
} from "./compose";
export {
  streamAnalyzeInformation,
  completeAnalyzeSubQuestion,
  maxAnalystHitsForProfile,
  MAX_SUB_QUESTION_HITS,
  streamAnalyzeSubQuestion,
} from "./stream";

/** LangGraph analyst 节点（经 custom 通道流式推送） */
export const runAnalystNode = async (
  state: PipelineGraphState,
  config: LangGraphRunnableConfig
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  if (!decision) {
    return { answer: "（未能理解您的问题，请换一种方式描述）" };
  }
  const write = getWriter(config);
  try {
    const sideBlock = sideEffectAnswerToAssistantBlock(state.sideEffectAnswer);
    if (sideBlock?.type === "text") {
      write?.({ type: "ui_block", block: sideBlock });
      write?.({
        type: "assistant",
        text: `${sideBlock.markdown}\n\n`,
      });
    }
    const gen = streamAnalyzeInformation({
      userQuestion: state.userQuestion,
      language: decision.language,
      subTasks: decision.subTasks,
      hits: state.hits,
      coverage: state.coverage,
      notes: state.notes,
      memoryBlock: state.memoryBlock,
      routeMode: decision.routeMode ?? "respondEarly",
      composeMode: decision.composeMode ?? "qa",
      queryType: decision.queryType,
      searchQuery: decision.searchQuery,
      topics: decision.topics,
      enumerationMeta: state.enumerationMeta ?? null,
      listIntent: decision.listIntent ?? null,
      compositeSubResults: state.compositeSubResults ?? undefined,
      compositeIncrementalPlan: state.compositeIncrementalPlan ?? undefined,
      asOfDate: state.asOfDate,
      toolResults: state.toolResults,
      sessionKey: {
        conversationId: state.context.conversationId,
        corpusUserId: state.context.corpusUserId,
      },
    });
    let result = await gen.next();
    while (!result.done) {
      write?.(result.value);
      result = await gen.next();
    }
    const side = state.sideEffectAnswer?.trim();
    const baseBlocks = result.value.blocks ?? [];
    const assistantBlocks = prependSideEffectAssistantBlocks(
      state.sideEffectAnswer,
      baseBlocks
    );
    return {
      answer: side ? `${side}\n\n${result.value.answer}` : result.value.answer,
      assistantBlocks: assistantBlocks.length > 0 ? assistantBlocks : null,
      citations: result.value.citations?.length ? result.value.citations : null,
      sideEffectAnswer: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "信息分析师调用失败";
    const answer = "（生成回答时出错，请稍后重试）";
    write?.({ type: "assistant", text: answer });
    return { error: msg, answer };
  }
};
