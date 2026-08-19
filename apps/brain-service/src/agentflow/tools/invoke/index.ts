/**
 * 生产路径唯一 dispatcher：按 toolId 调 `@/agentflow/tools/<folder>` 的 run*。
 */
import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import { runRetrieveCorpus } from "@/agentflow/tools/corpus";
import {
  runComposeEnumeration,
  runListCorpusEntries,
} from "@/agentflow/tools/enumeration";
import {
  runComputeAgeFromHits,
  runComputeTenureFromHits,
  runExtractIdentityFromHits,
} from "@/agentflow/tools/identity";
import { runExtractExternalLinksFromHits } from "@/agentflow/tools/links";
import { runSynthesizeMerge } from "@/agentflow/tools/synthesize";
import { runTranslateText } from "@/agentflow/tools/translate";
import { runSearchWeb } from "@/agentflow/tools/web";
import { IDENTITY_FIELD_BY_ID } from "@/agentflow/tools/catalog";
import type {
  ExecutionPlanNode,
  InvokeToolContext,
  ToolRunResult,
} from "./interface";

export type { InvokeToolContext } from "./interface";

const resolveIdentityFieldId = (
  field: string | null | undefined
): IntakeIdentityField => {
  if (field && field in IDENTITY_FIELD_BY_ID) {
    return field as IntakeIdentityField;
  }
  return "name";
};

export const invokeTool = async (
  node: ExecutionPlanNode,
  ctx: InvokeToolContext
): Promise<ToolRunResult> => {
  const hits = node.hitsOverride ?? ctx.hits;

  switch (node.toolId) {
    case "retrieve_corpus":
      return runRetrieveCorpus({
        corpusUserId: ctx.corpusUserId,
        actorUserId: ctx.actorUserId,
        searchQuery: node.searchQuery ?? ctx.userQuestion,
        queryType: node.queryType,
        topics: node.topics,
        subTasks: [node.label],
        label: node.label,
      });
    case "search_web":
      return runSearchWeb({
        corpusUserId: ctx.corpusUserId,
        actorUserId: ctx.actorUserId,
        query: node.webQuery ?? node.searchQuery ?? ctx.userQuestion,
      });
    case "translate_text":
      return runTranslateText({
        corpusUserId: ctx.corpusUserId,
        actorUserId: ctx.actorUserId,
        text: node.searchQuery?.trim() || ctx.userQuestion.trim() || "",
        targetLang: node.targetLang?.trim() || "",
        sourceLang: node.sourceLang ?? "auto",
        label: node.label,
      });
    case "compute_age_from_hits":
      return runComputeAgeFromHits({
        corpusUserId: ctx.corpusUserId,
        actorUserId: ctx.actorUserId,
        hits,
        asOfDate: ctx.asOfDate,
        language: ctx.language,
        label: node.label,
      });
    case "compute_tenure_from_hits":
      return runComputeTenureFromHits({
        hits,
        language: ctx.language,
        label: node.label,
        searchQuery: node.searchQuery,
        asOfDate: ctx.asOfDate,
      });
    case "extract_identity_from_hits":
      return runExtractIdentityFromHits({
        hits,
        field: resolveIdentityFieldId(node.field),
        language: ctx.language,
        label: node.label,
      });
    case "extract_external_links_from_hits":
      return runExtractExternalLinksFromHits({
        hits,
        language: ctx.language,
        label: node.label,
        userQuestion: node.label || ctx.userQuestion,
        parentUserQuestion: ctx.parentUserQuestion ?? ctx.userQuestion,
      });
    case "list_corpus_entries":
      return runListCorpusEntries({
        corpusUserId: ctx.corpusUserId,
        topics: node.topics ?? [],
        label: node.label,
        language: ctx.language,
      });
    case "compose_enumeration":
      return runComposeEnumeration({
        hits,
        language: ctx.language,
        topics: node.topics ?? ctx.decisionTopics ?? [],
        label: node.label,
        enumerationMeta: node.enumerationMetaOverride ?? ctx.enumerationMeta ?? null,
        notes: ctx.notes ?? null,
        listIntent: ctx.listIntent ?? null,
      });
    case "synthesize_merge":
      return runSynthesizeMerge({
        label: node.label,
        deps: node.deps.map((id) => ctx.prior[id]).filter(Boolean) as ToolRunResult[],
        userQuestion: ctx.userQuestion,
      });
    default:
      return {
        toolId: node.toolId,
        label: node.label,
        ok: false,
        answer: `未知工具：${node.toolId}`,
        citations: [],
        hits: [],
        insufficientEvidence: true,
        confidence: 0.5,
      };
  }
};
