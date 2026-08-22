/**
 * Analyst 消费 toolResults：对上这一问该用哪条，再收成 Analyst 结果。
 */
import { facetKeyMatchesIdentity } from "@/agentflow/cache";
import { isPostRetrievalToolId, resolveIdentityField } from "@/agentflow/tools/catalog";
import type {
  PipelineToolResults,
  ToolRunResult,
} from "@/agentflow/agents/online/tool-orchestrator/interface";
import type { InformationAnalystResult } from "../interface";
import { resolveAnalystQueryProfile } from "../limits";
import type { PickToolResultInput } from "./interface";

export type { PickToolResultInput } from "./interface";

export const toolRunToAnalystResult = (
  run: ToolRunResult
): InformationAnalystResult => ({
  answer: run.answer,
  citations: run.citations,
  confidence: run.confidence,
  insufficientEvidence: run.insufficientEvidence,
  blocks: run.blocks,
});

const isUsableSynthesis = (run: ToolRunResult | undefined): boolean =>
  Boolean(
    run?.toolId === "synthesize_merge" &&
      (run.matchReport || run.answer.includes("## 匹配点"))
  );

export const pickToolResultForSubQuestion = (
  input: PickToolResultInput,
  toolResults?: PipelineToolResults | null
): ToolRunResult | null => {
  if (!toolResults) return null;

  if (input.slotId) {
    const slotRun = toolResults[`slot_${input.slotId}`];
    if (slotRun) return slotRun;
  }

  const profile =
    input.queryType ??
    resolveAnalystQueryProfile({
      userQuestion: input.userQuestion,
      subTasks: [input.userQuestion],
    });

  if (profile === "enumeration" && toolResults.enumeration) {
    return toolResults.enumeration;
  }

  const identitySpec = resolveIdentityField(
    input.userQuestion,
    input.identityField
  );
  if (
    profile === "identity" &&
    identitySpec?.toolId === "extract_identity_from_hits"
  ) {
    const slotRun = input.slotId
      ? toolResults[`slot_${input.slotId}`]
      : null;
    if (slotRun?.toolId === "extract_identity_from_hits") return slotRun;
  }

  if (
    profile === "identity" &&
    (input.identityField === "age" ||
      facetKeyMatchesIdentity(input.facetKey, "age") ||
      identitySpec?.toolId === "compute_age_from_hits") &&
    toolResults.age
  ) {
    return toolResults.age;
  }

  if (profile === "external_link" && input.slotId) {
    const slotRun = toolResults[`slot_${input.slotId}`];
    if (slotRun?.toolId === "extract_external_links_from_hits") {
      return slotRun;
    }
  }

  if (input.slotId) {
    const dagRun = toolResults[input.slotId];
    if (isUsableSynthesis(dagRun)) return dagRun;
    /** 本槽无结果：禁止用袋内其它槽 / 唯一成功独立工具填稿 */
    return null;
  }

  if (isUsableSynthesis(toolResults.synthesis)) {
    return toolResults.synthesis;
  }

  if (toolResults.web) return toolResults.web;

  /** 无 slotId 的单槽：袋内恰好一条成功独立工具（get_weather / search_web / translate_text） */
  const standalone = Object.values(toolResults).filter(
    (r): r is ToolRunResult =>
      Boolean(
        r &&
          !isPostRetrievalToolId(r.toolId) &&
          r.toolId !== "synthesize_merge" &&
          r.ok &&
          r.answer.trim()
      )
  );
  if (standalone.length === 1) return standalone[0]!;

  return null;
};
