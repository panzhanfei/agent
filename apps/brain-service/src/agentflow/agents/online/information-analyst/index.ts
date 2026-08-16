import { getWriter } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  prependSideEffectAssistantBlocks,
  sideEffectAnswerToAssistantBlock,
} from "@/agentflow/agents/online/user-fact";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { streamAnalyzeInformation } from "./stream";

export { streamAnalyzeInformation } from "./stream";
export {
  completeAnalyzeSubQuestion,
  maxAnalystHitsForProfile,
  MAX_SUB_QUESTION_HITS,
  streamAnalyzeSubQuestion,
} from "./complete-analyze";
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
} from "./analyze-helpers";
export {
  prefersPlainTextAnalystStream,
  resolveAnalystQueryProfile,
} from "./analyst-recall-limits";
export {
  pickToolResultForSubQuestion,
  toolRunToAnalystResult,
  type PickToolResultInput,
} from "./pick-tool-result";
export {
  prompt,
  type Citation,
  type InformationAnalystInput,
  type InformationAnalystResult,
} from "./prompt";
export {
  citationSchema,
  informationAnalystResultSchema,
  parseAnalystResult,
} from "./schema";

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
