/** CorpusLister：语料目录列举分页（projects / experience），不经 KM hybrid。 */

import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { resolveIncrementalCompositePlan } from "@/agentflow/agents/online/knowledge-manager";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { fetchListSlot } from "./fetch-list-slot";
import { flattenListRetrieval } from "./flatten";
import { runListSlotWorker } from "./slot";

export { fetchListSlot } from "./fetch-list-slot";
export { flattenListRetrieval } from "./flatten";
export type { FlattenedListRetrieval, ListSlotRetrieval } from "./interface";
export { isPureListDecision } from "./route";
export {
  ENUMERATION_ACTION_PROMPTS,
  enumerationActionPrompt,
  matchUiEnumerationPrompt,
  findLastEnumerationBlock,
  resolveEnumerationPagination,
  enumerationBlockListKind,
  type EnumerationControl,
  type EnumerationControlAction,
  type EnumerationListKind,
  type SlotExecutor,
} from "./enumeration";
export {
  listCorpusEntriesPage,
  listAllCorpusEntries,
  corpusEntryToHit,
  retrieveEnumerationPage,
  ENUMERATION_PREVIEW_PAGE_SIZE,
  ENUMERATION_EXHAUSTIVE_PAGE_SIZE,
  collectEntryYears,
  entryOverlapsTimeWindow,
  extractRoleFromExperienceBody,
  type CorpusListKind,
  type CorpusEntryRow,
} from "./list";

/**
 * LangGraph `listRetriever` 节点：纯列举分页（UI 短路 / exhaustive / continue）。
 *
 * 入口：Intake 将 routeMode 收成 `listRetriever`（pathPlan 仅 list 槽、无 km/tool/dag）。
 * 跳过 planFanOut、FC、tool 编排；后段 contentOrganizer → analyst（不经 contentSummarizer）。
 */
export const runListRetrieverNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  const decision = state.decision;
  if (!decision) {
    return { error: "缺少入口路由决策" };
  }

  const slots = decision.compositeSlots ?? [];
  if (slots.length === 0) {
    return { error: "纯 list 路由缺少槽位定义" };
  }

  logAgentOut("ListRetriever", "进入", {
    slotCount: slots.length,
    listKinds: slots.map(
      (s) => s.enumerationControl?.listKind ?? s.label
    ),
  });

  try {
    const sessionKey = {
      conversationId: state.context.conversationId,
      corpusUserId: state.context.corpusUserId,
    };

    const incremental = await resolveIncrementalCompositePlan({
      session: sessionKey,
      userQuestion: state.userQuestion,
      slots,
    });

    const subResults = await Promise.all(
      slots.map((slot) =>
        fetchListSlot(
          slot,
          state.context.corpusUserId,
          state.asOfDate ?? null
        )
      )
    );

    const flattened = flattenListRetrieval(subResults);

    logAgentOut("ListRetriever", "完成", {
      hitCount: flattened.hits.length,
      coverage: flattened.coverage,
      page: flattened.enumerationMeta?.page ?? null,
      hasMore: flattened.enumerationMeta?.hasMore ?? null,
      facetCacheHits: incremental.facetCacheHits,
      incrementalSlotCount: incremental.slots.length,
    });

    return {
      hits: flattened.hits,
      coverage: flattened.coverage,
      notes: flattened.notes,
      confidenceTier: flattened.confidenceTier,
      enumerationMeta: flattened.enumerationMeta,
      compositeSubResults: subResults,
      compositeIncrementalPlan: incremental,
      compositeFacetCacheHits: incremental.facetCacheHits,
      retrievalCacheHit: false,
      retrievalCacheSlotHits: null,
      checkerPassed: true,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "列举分页检索失败";
    return { error: msg };
  }
};

/**
 * LangGraph `listRetrieve` 节点：复合路径每槽 Send 工人（executor=list_corpus）。
 * fetchListSlot → fanOutSlotPatches → planSlotJoin（不经 FC，与纯 listRetriever 一致）。
 */
export const runListRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("ListRetriever", "进入", {
    via: "listRetrieve",
    slotId: state.activeSlotId,
  });

  const patch = await runListSlotWorker(state);

  logAgentOut("ListRetriever", "出去", {
    via: "listRetrieve",
    slotId: patch.slotId,
    hitCount: patch.sub.hits.length,
    coverage: patch.sub.coverage,
    fcSkipped: true,
  });

  return { fanOutSlotPatches: [patch] };
};
