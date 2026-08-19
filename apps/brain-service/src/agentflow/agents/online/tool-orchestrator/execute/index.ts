/**
 * 执行层：plan 节点 → invoke。具体实现在 `@/agentflow/tools/<name>`。
 */
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { invokeTool } from "@/agentflow/tools/invoke";
import { runRetrieveCorpus } from "@/agentflow/tools/local/corpus";
import {
  runComposeEnumeration,
  runListCorpusEntries,
} from "@/agentflow/tools/local/enumeration";
import {
  runComputeAgeFromHits,
  runComputeTenureFromHits,
  runExtractIdentityFromHits,
} from "@/agentflow/tools/local/identity";
import { runExtractExternalLinksFromHits } from "@/agentflow/tools/local/links";
import { runSynthesizeMerge } from "@/agentflow/tools/local/synthesize";
import { runTranslateText } from "@/agentflow/tools/local/translate";
import { runSearchWeb } from "@/agentflow/tools/local/web";
import { resolveIdentityField } from "../catalog";
import type {
  ExecutionPlanNode,
  PipelineToolResults,
  ToolRunId,
  ToolRunResult,
} from "../interface";
import { isPostRetrievalToolId } from "../interface";

export const runExecutionPlanNode = async (
  node: ExecutionPlanNode,
  ctx: {
    state: PipelineGraphState;
    prior: PipelineToolResults;
  }
): Promise<ToolRunResult> => {
  const { state, prior } = ctx;
  const { corpusUserId, actorUserId } = state.context;
  return invokeTool(node, {
    corpusUserId,
    actorUserId,
    userQuestion: state.userQuestion,
    parentUserQuestion: state.userQuestion,
    asOfDate: state.asOfDate ?? new Date().toISOString().slice(0, 10),
    language: state.decision?.language ?? "zh",
    hits: node.hitsOverride ?? state.hits,
    prior,
    notes: state.notes,
    enumerationMeta: node.enumerationMetaOverride ?? state.enumerationMeta,
    listIntent: state.decision?.listIntent ?? null,
    decisionTopics: state.decision?.topics ?? [],
  });
};

export const resolvePostRetrievalToolRuns = (
  state: PipelineGraphState
): Array<{ key: string; node: ExecutionPlanNode }> => {
  const decision = state.decision;
  if (!decision) return [];

  const runs: Array<{ key: string; node: ExecutionPlanNode }> = [];
  const enrichedSlots = (decision.compositeSlots ?? []) as Array<
    (typeof decision.compositeSlots)[number] & {
      toolId?: ToolRunId | null;
      dataSource?: string;
      field?: string | null;
    }
  >;

  if (state.compositeSubResults) {
    for (const sub of state.compositeSubResults) {
      const slot = enrichedSlots.find((s) => s.id === sub.slot);
      if (
        !slot?.toolId ||
        !isPostRetrievalToolId(slot.toolId) ||
        slot.executor === "mem_recall" ||
        slot.executor === "tool_run" ||
        slot.executor === "summarize_slot" ||
        slot.dataSource === "mem0" ||
        slot.dataSource === "user_text" ||
        sub.hits.length === 0 ||
        sub.coverage === "none"
      ) {
        continue;
      }
      runs.push({
        key: `slot_${sub.slot}`,
        node: {
          id: sub.slot,
          label: sub.label,
          searchQuery: slot.searchQuery,
          dataSource:
            slot.toolId === "compute_age_from_hits" ||
            slot.toolId === "compute_tenure_from_hits"
              ? "compute"
              : "corpus",
          toolId: slot.toolId,
          queryType: slot.queryType,
          topics: slot.topics,
          field: slot.field ?? slot.identityField ?? null,
          deps: [],
          hitsOverride: sub.hits,
          enumerationMetaOverride: sub.enumerationMeta ?? null,
        },
      });
    }
    return runs;
  }

  const enriched =
    decision.enrichedPlan ??
    (decision.retrievalPlan ?? []).map((p) => ({
      ...p,
      dataSource: "corpus" as const,
      field: resolveIdentityField(p.label, p.identityField)?.id ?? null,
      toolId: null as ToolRunId | null,
    }));

  const enumItem = enriched.find(
    (p) => p.toolId === "compose_enumeration" || p.queryType === "enumeration"
  );
  if (
    enumItem &&
    state.hits.length > 0 &&
    decision.queryType === "enumeration"
  ) {
    runs.push({
      key: "enumeration",
      node: {
        id: "enumeration",
        label: enumItem.label,
        dataSource: "corpus",
        toolId: "compose_enumeration",
        queryType: "enumeration",
        topics: enumItem.topics,
        deps: [],
      },
    });
  }

  const ageFromPlan = (decision.retrievalPlan ?? []).find(
    (p) => p.identityField === "age"
  );
  const ageItem =
    enriched.find((p) => p.toolId === "compute_age_from_hits") ??
    (decision.queryType === "identity" && ageFromPlan
      ? {
          label: ageFromPlan.label || "年龄",
          toolId: "compute_age_from_hits" as const,
          field: "age",
        }
      : null);

  if (ageItem && state.hits.length > 0 && state.coverage !== "none") {
    runs.push({
      key: "age",
      node: {
        id: "age",
        label: ageItem.label ?? "年龄",
        dataSource: "compute",
        toolId: "compute_age_from_hits",
        field: "age",
        deps: [],
      },
    });
  }

  return runs;
};

/** @deprecated 改从 `@/agentflow/tools` 引入 run* */
export {
  runRetrieveCorpus as invokeRetrieveCorpus,
  runSearchWeb as invokeSearchWeb,
  runTranslateText as invokeTranslateText,
  runComputeAgeFromHits as invokeComputeAge,
  runComputeTenureFromHits as invokeComputeTenure,
  runExtractIdentityFromHits as invokeExtractIdentityField,
  runExtractExternalLinksFromHits as invokeExtractExternalLinks,
  runComposeEnumeration as invokeComposeEnumeration,
  runSynthesizeMerge as invokeSynthesizeMerge,
};
