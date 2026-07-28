/**
 * 单槽 list_corpus 检索：目录扫盘分页，供 listRetriever 与 composite 混槽复用。
 *
 * 页码由 Intake 写入 slot.enumerationPage / enumerationPageSize（来自 history blocks）；
 * 本模块只执行扫盘，不解析用户口语。
 */
import { resolveEnumerationTarget } from "@/agentflow/agents/online/intake-coordinator";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import { retrieveEnumerationPage } from "../list";

/**
 * 对单个 list 槽执行语料目录分页检索，返回 composite 子问结构。
 */
export const fetchListSlot = async (
  slot: CompositeRetrievalSlot,
  corpusUserId: string,
  asOfDate?: string | null
): Promise<CompositeSubRetrieval> => {
  const listKind =
    slot.enumerationControl?.listKind ??
    resolveEnumerationTarget({
      label: slot.label,
      searchQuery: slot.searchQuery,
      topics: slot.topics,
      subTasks: slot.subTasks,
      listKind: slot.enumerationControl?.listKind ?? null,
    });
  const page = slot.enumerationPage ?? 1;
  const pageSize = slot.enumerationPageSize ?? 20;

  const retrieval = await retrieveEnumerationPage({
    corpusUserId,
    listKind,
    page,
    pageSize,
    timeWindowYears: slot.enumerationControl?.timeWindowYears ?? null,
    asOfDate,
  });

  return {
    slot: slot.id,
    facetKey: `list:${listKind}:p${page}`,
    label: slot.label,
    hits: retrieval.hits,
    coverage: retrieval.coverage,
    notes: retrieval.notes,
    ...(retrieval.confidenceTier
      ? { confidenceTier: retrieval.confidenceTier }
      : {}),
    ...(retrieval.enumerationMeta
      ? { enumerationMeta: retrieval.enumerationMeta }
      : {}),
    cacheHit: false,
    facetAnswerCacheHit: false,
  };
};
