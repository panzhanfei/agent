import { dedupeCitations } from "@/agentflow/agents/online/content-organizer";
import type {
  KnowledgeHit,
  KnowledgeRetrievalResult,
} from "@/agentflow/agents/online/knowledge-manager";
import type { QueryProfile } from "@/agentflow/agents/online/knowledge-manager";
import {
  resolveAnalystQueryProfile,
} from "../limits";
import { memoryBlockHasStructuredUserFacts } from "@/agentflow/agents/online/user-fact";
import { facetKeyMatchesIdentity } from "@/agentflow/cache";
import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";
import {
  resolveOrchestratedTool,
  runOrchestratedSubQuestion,
} from "@/agentflow/tools/orchestrated";
import type { PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/interface";
import {
  pickToolResultForSubQuestion,
  toolRunToAnalystResult,
} from "../pick-tool-result";
import {
    compactExcerptLine,
    composeEnumerationAnswer,
    formatHitsAsAnswerList,
    hitDisplayTitle,
} from "../compose";
import type {
  Citation,
  InformationAnalystInput,
  InformationAnalystResult,
} from "../interface";
import { parseAnalystResult } from "../contract";
export { parseAnalystResult as normalizeAnalystResult };
export { formatHitsAsAnswerList, hitDisplayTitle, compactExcerptLine } from "../compose";

/** 单个子问题 Analyst 输入（composite map） */
export type SubQuestionAnalyzeInput = {
  userQuestion: string;
  language: "zh" | "en" | "mixed";
  hits: KnowledgeHit[];
  coverage: KnowledgeRetrievalResult["coverage"];
  notes: string | null;
  /** Intake / 槽位 queryType，驱动 prompt 与 fallback 形态 */
  queryType?: QueryProfile;
  /** 槽位 topics（区分项目列举 vs 公司列举） */
  topics?: string[];
  /** KM 列举元数据（total/shown） */
  enumerationMeta?: import("@/agentflow/agents/online/knowledge-manager").EnumerationMeta | null;
  listIntent?: import("@/agentflow/agents/online/intake-coordinator").EnumerationListIntent | null;
  /** 年龄等编排工具计算基准日 YYYY-MM-DD，默认当天 */
  asOfDate?: string;
  /** 槽 searchQuery（tenure 雇主匹配用 Intake 结构化检索词） */
  searchQuery?: string;
  /** composite 槽位 id（toolResults 键 slot_<id>） */
  slotId?: string;
  /** 槽答案缓存键（如 id:age:今年多大），供空结果文案分型 */
  facetKey?: string;
  /** Intake identityField（优先于 facetKey） */
  identityField?: IntakeIdentityField | null;
  /** 用户原问（external_link 链接类型/实体过滤 hint） */
  parentUserQuestion?: string;
  /** ToolOrchestrator 预计算结果（优先于 Analyst 内联编排） */
  toolResults?: PipelineToolResults | null;
  /** 槽 dataSource（mem0 / user_text / corpus…） */
  dataSource?: string | null;
  /** mem 槽召回值 */
  recalledFact?: {
    factKey: string;
    label: string;
    value: string | null;
  } | null;
  /** 父轮 memoryBlock（复合子问也可据 Mem0 答自述字段） */
  memoryBlock?: string | null;
  /** HITL 等工人挂载的 UI 块 */
  assistantBlocks?: import("@fambrain/brain-types").AssistantMessageBlock[];
};

export const shouldSkipSubQuestionLlm = (
  input: SubQuestionAnalyzeInput
): boolean =>
  Boolean(input.recalledFact) ||
  Boolean(input.assistantBlocks?.length) ||
  input.dataSource === "mem0" ||
  input.dataSource === "user_text" ||
  input.hits.length === 0 ||
  input.coverage === "none" ||
  pickToolResultForSubQuestion(input, input.toolResults) !== null ||
  resolveOrchestratedTool(input) !== null;

/** P0-12：FC 二次放行后 hits 仍空时跳过 Analyst LLM；Mem0 有结构化 user_fact 时不 skip */
export const shouldSkipAnalystLlm = (input: InformationAnalystInput): boolean => {
    if (
      input.compositeSubResults?.some((s) => (s.assistantBlocks?.length ?? 0) > 0)
    ) {
      return true;
    }
    if (input.hits.length > 0 && input.coverage !== "none") return false;
    if (memoryBlockHasStructuredUserFacts(input.memoryBlock)) return false;
    return input.hits.length === 0 || input.coverage === "none";
};

export const formatSubQuestionSection = (
  index: number,
  label: string,
  answer: string
): string => `${index}. ${label}\n${answer.trim()}`;

export const mergeSubQuestionAnswers = (
  sections: Array<{
    order: number;
    label: string;
    result: InformationAnalystResult;
  }>
): InformationAnalystResult => {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const answer = sorted
    .map((s, i) => formatSubQuestionSection(i + 1, s.label, s.result.answer))
    .join("\n\n");
  const citations = dedupeCitations(sorted.flatMap((s) => s.result.citations));
  const insufficientEvidence = sorted.every(
    (s) => s.result.insufficientEvidence
  );
  const confidence =
    sorted.length === 0
      ? 0.5
      : sorted.reduce((sum, s) => sum + s.result.confidence, 0) / sorted.length;
  return {
    answer,
    citations,
    confidence,
    insufficientEvidence,
  };
};

const resolveIdentityEmptyKind = (input: {
  queryType?: QueryProfile;
  identityField?: IntakeIdentityField | null;
  facetKey?: string;
}): "age" | "name" | null => {
  if (input.queryType && input.queryType !== "identity") return null;
  if (input.identityField === "age" || facetKeyMatchesIdentity(input.facetKey, "age")) {
    return "age";
  }
  if (input.identityField === "name" || facetKeyMatchesIdentity(input.facetKey, "name")) {
    return "name";
  }
  return null;
};

const buildEmptyHitsFallback = (
  input: Pick<
    InformationAnalystInput,
    "userQuestion" | "language" | "subTasks" | "queryType"
  > & {
    identityField?: IntakeIdentityField | null;
    facetKey?: string;
    dataSource?: string | null;
    recalledFact?: SubQuestionAnalyzeInput["recalledFact"];
  }
): InformationAnalystResult => {
  const { userQuestion, language, subTasks, queryType } = input;

  if (input.dataSource === "mem0" || input.recalledFact) {
    const label =
      input.recalledFact?.label?.trim() ||
      userQuestion.trim() ||
      (language === "en" ? "that field" : "该字段");
    if (input.recalledFact?.value) {
      return {
        answer:
          language === "en"
            ? `Your saved ${label} is ${input.recalledFact.value}.`
            : `您保存的${label}是：${input.recalledFact.value}。`,
        citations: [],
        confidence: 0.95,
        insufficientEvidence: false,
      };
    }
    return {
      answer:
        language === "en"
          ? `I don't have a saved value for ${label} yet. Tell me what to remember.`
          : `尚未记住您的${label}。您可以说「记住我的${label}是…」让我保存。`,
      citations: [],
      confidence: 0.9,
      insufficientEvidence: true,
    };
  }

  if (input.dataSource === "user_text") {
    return {
      answer:
        language === "en"
          ? "No text was available to summarize for this step."
          : "本步没有可总结的正文。",
      citations: [],
      confidence: 0.9,
      insufficientEvidence: true,
    };
  }

  const profile = resolveAnalystQueryProfile({
    userQuestion,
    subTasks,
    queryType,
  });
  const kind = resolveIdentityEmptyKind({
    queryType: profile,
    identityField: input.identityField,
    facetKey: input.facetKey,
  });

  if (kind === "age") {
    return {
      answer:
        language === "en"
          ? "Your knowledge base resume does not record a current age or birth date, so I cannot answer how old you are this year."
          : "个人知识库中的简历未标注当前年龄或出生日期，无法据此回答「今年多大」。",
      citations: [],
      confidence: 0.9,
      insufficientEvidence: true,
    };
  }
  if (kind === "name") {
    return {
      answer:
        language === "en"
          ? "No name was found in your personal knowledge base resume."
          : "个人知识库中未检索到姓名相关简历内容。",
      citations: [],
      confidence: 0.9,
      insufficientEvidence: true,
    };
  }

  const answer =
    language === "en"
      ? "No relevant content was found in the personal knowledge base for your question. Try naming a specific company or project, or add/update the matching markdown under data/doc/users/<corpusUserId>/corpus/ (personal|experience|projects) via corpus edit."
      : "当前个人知识库中没有检索到与你问题直接相关的内容。你可以补充具体公司、项目名称；若要新建/打开/修改语料文件，请给出可解析路径（如 personal/xxx.md）走语料修订，目录为 data/doc/users/<语料归属账号>/corpus/。";
  return {
    answer,
    citations: [],
    confidence: 0.9,
    insufficientEvidence: true,
  };
};

export const buildSubQuestionFallbackAnswer = (
  input: SubQuestionAnalyzeInput
): InformationAnalystResult => {
  const { userQuestion, hits, coverage, language, queryType } = input;

  if (input.recalledFact?.value) {
    const label = input.recalledFact.label || userQuestion;
    return {
      answer:
        language === "en"
          ? `Your saved ${label} is ${input.recalledFact.value}.`
          : `您保存的${label}是：${input.recalledFact.value}。`,
      citations: [],
      confidence: 0.95,
      insufficientEvidence: false,
    };
  }

  if (input.assistantBlocks?.length) {
    return {
      answer: input.notes?.trim() || userQuestion,
      citations: [],
      confidence: 0.95,
      insufficientEvidence: false,
      blocks: input.assistantBlocks,
    };
  }

  const fromTools = pickToolResultForSubQuestion(input, input.toolResults);
  if (fromTools) return toolRunToAnalystResult(fromTools);

  if (
    input.dataSource === "mem0" ||
    input.recalledFact ||
    hits.length === 0 ||
    coverage === "none"
  ) {
    const empty = buildEmptyHitsFallback({
      userQuestion,
      language,
      subTasks: [userQuestion],
      queryType,
      identityField: input.identityField,
      facetKey: input.facetKey,
      dataSource: input.dataSource,
      recalledFact: input.recalledFact,
    });
    if (input.dataSource === "mem0" || input.recalledFact) {
      return empty;
    }
    return {
      ...empty,
      answer:
        language === "en"
          ? `No knowledge base content for: ${userQuestion}`
          : `知识库未覆盖：${userQuestion}`,
    };
  }

  const orchestrated = runOrchestratedSubQuestion(input);
  if (orchestrated) return orchestrated;

  let hitsForAnswer = hits;
  const citations: Citation[] = dedupeCitations(
    hitsForAnswer.map((h) => ({ path: h.path, excerpt: h.excerpt }))
  );

  const answer =
    hitsForAnswer.length === 1
      ? language === "en"
        ? `${hitDisplayTitle(hitsForAnswer[0]!)}: ${compactExcerptLine(hitsForAnswer[0]!.excerpt)}`
        : `${hitDisplayTitle(hitsForAnswer[0]!)}：${compactExcerptLine(hitsForAnswer[0]!.excerpt)}`
      : formatHitsAsAnswerList(hitsForAnswer, language);

  return {
    answer,
    citations,
    confidence: coverage === "sufficient" ? 0.75 : 0.6,
    insufficientEvidence: false,
  };
};

export const buildFallbackAnswer = (
  input: InformationAnalystInput
): InformationAnalystResult => {
  const { userQuestion, hits, coverage, notes, language, queryType, subTasks } =
    input;

  const hitlSubs = (input.compositeSubResults ?? []).filter(
    (s) => (s.assistantBlocks?.length ?? 0) > 0
  );
  if (hitlSubs.length > 0) {
    const answer = hitlSubs
      .map((s) => s.notes?.trim())
      .filter(Boolean)
      .join("\n\n") || notes?.trim() || userQuestion;
    return {
      answer,
      citations: [],
      confidence: 0.95,
      insufficientEvidence: false,
      blocks: hitlSubs.flatMap((s) => s.assistantBlocks ?? []),
    };
  }

  const fromTools = pickToolResultForSubQuestion(
    {
      userQuestion,
      language,
      hits,
      coverage,
      notes,
      queryType: queryType ?? undefined,
      topics: input.topics ?? [],
      enumerationMeta: input.enumerationMeta ?? null,
      listIntent: input.listIntent ?? null,
      asOfDate: input.asOfDate,
      toolResults: input.toolResults,
    },
    input.toolResults
  );
  if (fromTools) return toolRunToAnalystResult(fromTools);

  if (hits.length === 0 || coverage === "none") {
    return buildEmptyHitsFallback({
      userQuestion,
      language,
      subTasks,
      queryType,
    });
  }

  const orchestrated = runOrchestratedSubQuestion({
    userQuestion,
    language,
    hits,
    coverage,
    notes,
    queryType: queryType ?? undefined,
    topics: input.topics ?? [],
    enumerationMeta: input.enumerationMeta ?? null,
    listIntent: input.listIntent ?? null,
    asOfDate: new Date().toISOString().slice(0, 10),
  });
  if (orchestrated) return orchestrated;

  const profile = resolveAnalystQueryProfile({
    userQuestion,
    subTasks,
    queryType,
  });

  if (profile === "enumeration") {
    return composeEnumerationAnswer({
      hits,
      language,
      topics: input.topics ?? [],
      label: userQuestion,
      enumerationMeta: input.enumerationMeta,
      notes,
      listIntent: input.listIntent,
    });
  }

  const citations: Citation[] = dedupeCitations(
    hits.map((h) => ({
      path: h.path,
      excerpt: h.excerpt,
    }))
  );

  let answer = formatHitsAsAnswerList(hits, language);

  if (coverage === "partial") {
    answer +=
      language === "en"
        ? "\n\n(Some details may be missing from the retrieved excerpts.)"
        : "\n\n（部分细节可能未在检索片段中覆盖。）";
  }
  if (notes) {
    answer += language === "en" ? `\n\nNote: ${notes}` : `\n\n备注：${notes}`;
  }
  return {
    answer,
    citations,
    confidence: coverage === "sufficient" ? 0.75 : 0.6,
    insufficientEvidence: false,
  };
};

/** 将单问输入映射为子问流式输入（共享纯文本 Analyst 路径） */
export const toSubQuestionInput = (
  input: InformationAnalystInput,
  profile: QueryProfile,
  hits: KnowledgeHit[]
): SubQuestionAnalyzeInput => ({
  userQuestion: input.userQuestion,
  language: input.language,
  hits,
  coverage: input.coverage,
  notes: input.notes,
  queryType: profile,
  topics: input.topics ?? [],
  enumerationMeta: input.enumerationMeta ?? null,
  listIntent: input.listIntent ?? null,
  asOfDate: input.asOfDate ?? new Date().toISOString().slice(0, 10),
  toolResults: input.toolResults,
  searchQuery: input.searchQuery,
});
