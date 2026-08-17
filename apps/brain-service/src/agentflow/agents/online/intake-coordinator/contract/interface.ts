/**
 * Intake contract 类型（prompt 字符串见 prompt.ts）。
 */
import type { EnumerationControl } from "@/agentflow/agents/online/corpus-lister/enumeration";
import type {
  ComposeMode,
  PathPlan,
} from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";

export type { EnumerationControl };

export type IntakeIdentityField =
  | "name"
  | "age"
  | "birthYear"
  | "email"
  | "phone"
  | "education"
  | "career"
  | "tenure";

/** 多轮指代状态（由 LLM 标注；unresolved → clarify；服务端不再拼接二次调用） */
export type IntakeCoreferenceStatus = "none" | "resolved" | "unresolved";

/** 多问 / 综合档案：每项对应一次独立检索或列举（编排器主路由信号） */
export type IntakeRetrievalPlanItem = {
  /** 面向用户的子问题摘要，供 Analyst 分段标题 */
  label: string;
  /** 该子问题专用检索词（须含实体/字段词，勿复制用户口语整句） */
  searchQuery: string;
  queryType: "identity" | "enumeration" | "tech" | "external_link" | "relations" | "default";
  topics: string[];
  /**
   * 列举控制（仅 kind=list / queryType=enumeration 需要）：
   * preview=首屏目录分页（8 条）；continue=下一页；exhaustive=目录扫盘穷举（通常 20 条/页）。
   * 混合问时只给「列出全部」那一项填此字段，勿整句套用。
   */
  enumerationControl?: EnumerationControl | null;
  /**
   * identity 子字段（仅 queryType=identity 时填写）：
   * name/age/birthYear/email/phone/education/career/tenure；供工具与 facetKey；勿用 label 正则猜字段。
   */
  identityField?: IntakeIdentityField | null;
};

export type IntakeRoutingDecision = {
  /**
   * 主意图分类（8 种）。Mem0/LangMem 已在 preparePipelineMemory 加载；本 JSON 只定路由。
   *
   * | intent | 含义 | 典型字段 | pipeline | routeAfterIntake → |
   * |--------|------|----------|----------|---------------------|
   * | retrieve_and_answer | 查语料答经历/项目/技术/简历档案 | searchQuery（服务端恒走 KM） | ⑤⑥ plan/composite | retrieval → FC → analyst |
   * | summarize_content | 总结/概括某段内容 | 非空 searchQuery 先查库；粘贴长文则 searchQuery 留空 |  | retrieval 或 contentSummarizer |
   * | direct_answer | 通用短答，与本人履历无关 | briefReply | 可能早退 | respondEarly |
   * | clarify | 指代不明/缺实体，反问用户 | clarifyingQuestion | ② 早退 | respondEarly |
   * | chitchat | 问候、闲聊（「你好」等必须 chitchat+空 steps，禁止 mem/recall） | briefReply=null（服务端注入固定话术） | ③ 早退 | respondEarly |
   * | out_of_scope | 越界/有害，拒绝 | briefReply | 可能早退 | respondEarly |
   * | remember_user_fact | 记住用户口述（QQ/微信等，不在简历） | userFactKey/Label/Value | ④ 早退 | userFact 节点 → 写入 Mem0 |
   * | recall_user_fact | 召回已记住字段 | userFactKey/Label；value=null | ④ 早退 | userFact 节点 → 读 memoryBlock/userMemories |
   *
   * 简历已有事实（姓名/年龄/经历）用 retrieve_and_answer，不用 recall_user_fact。
   */
  intent:
    | "retrieve_and_answer"
    | "summarize_content"
    | "direct_answer"
    | "clarify"
    | "chitchat"
    | "out_of_scope"
    | "remember_user_fact"
    | "recall_user_fact";
  /**
   * 供检索用的查询句：中文为主，可含英文技术词；
   * 应脱离寒暄、指代词，保留实体（公司/项目/技术栈/时间）。
   */
  searchQuery: string;
  /** 可选子任务拆分，每项一句、可独立检索或分析 */
  subTasks: string[];
  /** 主题标签，便于过滤语料（见 doc：experience / projects / personal） */
  topics: string[];
  /** 用户主要使用的语言 */
  language: "zh" | "en" | "mixed";
  /** 0–1，对 intent 与 searchQuery 的把握 */
  confidence: number;
  /**
   * 检索问法类型（retrieve_and_answer / summarize 需查库时建议填写）；
   * 与 KnowledgeManager queryProfile 对齐。
   */
  queryType:
    | "identity"
    | "enumeration"
    | "tech"
    | "external_link"
    | "relations"
    | "default"
    | null;
  /**
   * intent 为 clarify 时：向用户提出的单个澄清问题；
   * 其他 intent 为 null。
   */
  clarifyingQuestion: string | null;
  /**
   * 无需下游长分析时可给用户的极短回复（≤80 字）；retrieve / summarize 必须为 null。
   */
  briefReply: string | null;
  /**
   * 兼容/派生用：可由 pathPlan.steps 生成；LLM 可不填。
   */
  retrievalPlan: IntakeRetrievalPlanItem[];
  /**
   * retrieve_and_answer 必填：有序执行计划 pathPlan.steps[]。
   * 服务端只合法化（白名单/去重/list 页码），按 steps 数组顺序派生 compositeSlots。
   * 兼容旧四桶 {km,list,tool,dag}+answerOrder（legalize 会转成 steps）。
   */
  pathPlan?: PathPlan | null;
  /**
   * 可选：步 id 顺序；缺省时以 pathPlan.steps 数组顺序为准（可省略或镜像 step ids）。
   */
  answerOrder?: string[] | null;
  /** qa | composite | summarize；缺省时服务端按步数推断 */
  composeMode?: ComposeMode | null;
  /**
   * intent 为 remember_user_fact / recall_user_fact 时必填：
   * 稳定键（英文 slug），如 qq、wechat、dingtalk、phone、email。
   */
  userFactKey: string | null;
  /** 面向用户的字段名，如「QQ号」「微信号」「钉钉号」 */
  userFactLabel: string | null;
  /** remember_user_fact 时：用户要保存的值；recall 时为 null */
  userFactValue: string | null;
  /**
   * 本轮有聊天附件（系统提示会声明）时必填：
   * extract=展示已抽取原文 · summarize=总结 · translate=翻译（须在 pathPlan 步填 targetLang）。
   * 旧 ingest 由 schema 合法化为 summarize（入库改走写回闸门）。
   * 无附件时为 null。禁止用口语词表猜；意图不清 → clarify。
   */
  attachmentAction?: "extract" | "summarize" | "translate" | null;
  /**
   * 多轮指代状态：
   * - none：无指代 / 不涉及
   * - resolved：本轮已在 searchQuery/plan 写明实体
   * - unresolved：指代未消解 → clarify；服务端**不再**拼接二次调用
   */
  coreference?: IntakeCoreferenceStatus;
};

/**
 * @deprecated 阶段 0 废除 Plan 级指代拼接；保留导出以免旧脚本 import 崩。
 */
