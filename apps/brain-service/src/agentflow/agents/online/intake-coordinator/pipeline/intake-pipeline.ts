/**
 * Intake 编排（LLM 之后）：parse → early-exit → legalize PathPlan → 派生 slots。
 * 每步打结构化日志，供 Web 运行日志 / 控制台复盘。
 *
 * 端到端：LLM 出 pathPlan.steps[]；代码只合法化、结构归一、补 list 页码、派生 compositeSlots。
 * 三信号指代 merge 在 intake-node；continuation 恒 noop。
 */
import {
  applyIntakeChitchatGuard,
  applyIntakeContinuationGuard,
  applyIntakeLinkLookupGuard,
  type RoutedIntakeDecision,
} from "@/agentflow/agents/online/intake-coordinator/guards";
import {
  clarifyFallbackFromProse,
  defaultIntakeDecision,
  parseIntakeDecision,
} from "./parse-intake";
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import {
  defaultComposeMode,
  deriveCompositeSlotsFromPathPlan,
  deriveRetrievalPlanFromPathPlan,
  emptyPathPlan,
  ensureMemRecallStepFromTopUserFact,
  executionPlanFromPathPlanDag,
  fillListPagesInPathPlan,
  isPathPlanEmpty,
  legalizeAnswerOrder,
  legalizeComposeMode,
  legalizePathPlan,
  reorderPathPlanByAnswerOrder,
} from "@/agentflow/agents/online/intake-coordinator/path-plan";
import { isUserFactIntent, normalizeFactKey } from "@/agentflow/agents/online/user-fact";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { DbChatTurn } from "@fambrain/brain-types";
import { resolveIntakeGraphRouteMode } from "./resolve-graph-route-mode";

const summarizeDecision = (
  decision: IntakeRoutingDecision | RoutedIntakeDecision
) => ({
  intent: decision.intent,
  searchQuery: decision.searchQuery,
  queryType: decision.queryType,
  subTasks: decision.subTasks,
  topics: decision.topics,
  confidence: decision.confidence,
  clarifyingQuestion: decision.clarifyingQuestion,
  briefReply: decision.briefReply,
  retrievalPlanCount: decision.retrievalPlan?.length ?? 0,
  retrievalPlanLabels: (decision.retrievalPlan ?? []).map((p) => p.label),
  answerOrder: decision.answerOrder ?? [],
  pathPlanCounts: decision.pathPlan
    ? (() => {
        const steps = decision.pathPlan.steps ?? [];
        return {
          km: steps.filter((s) => s.kind === "km").length,
          list: steps.filter((s) => s.kind === "list").length,
          mem: steps.filter((s) => s.kind === "mem").length,
          tool: steps.filter((s) => s.kind === "tool").length,
          summarize: steps.filter((s) => s.kind === "summarize").length,
          dag: steps.filter((s) => s.kind === "dag").length,
        };
      })()
    : null,
  userFactKey: decision.userFactKey,
  userFactLabel: decision.userFactLabel,
  ...("routeMode" in decision
    ? {
        routeMode: decision.routeMode,
        compositeSlotCount: decision.compositeSlots?.length ?? 0,
        compositeSlotLabels: (decision.compositeSlots ?? []).map(
          (s) => s.label
        ),
        routeReason: decision.routeReason,
        routePlanSource: decision.routePlanSource,
        userFactAction: decision.userFact?.action ?? null,
      }
    : {}),
});

const guardChanged = (
  before: IntakeRoutingDecision,
  after: IntakeRoutingDecision
): boolean =>
  JSON.stringify(summarizeDecision(before)) !==
  JSON.stringify(summarizeDecision(after));

/**
 * 早退包装：把 IntakeRoutingDecision 升成 RoutedIntakeDecision，但不安排检索。
 * routeMode 走 resolveIntakeGraphRouteMode（remember/recall → userFact，勿一律 respondEarly）。
 */
export const buildEarlyExitRoutedDecision = (
  decision: IntakeRoutingDecision
): RoutedIntakeDecision => {
  const routed: RoutedIntakeDecision = {
    ...decision,
    routeMode: "respondEarly",
    compositeSlots: [],
    pathPlan: emptyPathPlan(),
    answerOrder: [],
    composeMode: defaultComposeMode(),
    routeReason: "skip_non_retrieve",
    routePlanSource: "none",
  };
  routed.routeMode = resolveIntakeGraphRouteMode(routed);
  return routed;
};

/** LLM 判定需反问（无上下文或指代无法消解）→ pipeline 早退 */
export const isClarifyEarlyExit = (decision: IntakeRoutingDecision): boolean =>
  decision.intent === "clarify" && Boolean(decision.clarifyingQuestion?.trim());

/** 闲聊 / 超范围 / 短 direct_answer → respondEarly */
export const isRespondEarlyIntent = (
  decision: IntakeRoutingDecision
): boolean => {
  if (isClarifyEarlyExit(decision)) return true;
  if (
    (decision.intent === "chitchat" || decision.intent === "out_of_scope") &&
    Boolean(decision.briefReply?.trim())
  ) {
    return true;
  }
  return (
    decision.intent === "direct_answer" && Boolean(decision.briefReply?.trim())
  );
};

export type RunIntakePipelineInput = {
  intakeRaw: string;
  userQuestion: string;
  intakeHistory: DbChatTurn[];
  /** 完整对话 history（含 blocks）；列举续页从末条 assistant enumeration block 解析 */
  history?: DbChatTurn[];
};

export type RunIntakePipelineResult = {
  decision: RoutedIntakeDecision;
  parseUsedFallback: boolean;
  /** true：clarify/chitchat/userFact 等早退；继续检索则为 false */
  earlyExit: boolean;
};

const emptyPlanClarify = (
  decision: IntakeRoutingDecision
): IntakeRoutingDecision => ({
  ...decision,
  intent: "clarify",
  searchQuery: "",
  queryType: null,
  clarifyingQuestion:
    decision.clarifyingQuestion?.trim() ||
    "请再说清楚你想了解哪一方面（例如某段经历、某个项目，或姓名/年龄等）？",
  briefReply: null,
  retrievalPlan: [],
  pathPlan: emptyPathPlan(),
  answerOrder: [],
  composeMode: "qa",
  confidence: Math.min(decision.confidence, 0.55),
  coreference: decision.coreference ?? "none",
});

/**
 * Intake 规则主流程（LLM 之后）：
 *   ① parse+兜底 → ②a continuation noop → ②–④ early-exit →
 *   ⑤a link harmonize → ⑥ legalize PathPlan → ⑦ fill pages → ⑧ derive slots
 */
export const runIntakePipeline = async (
  input: RunIntakePipelineInput
): Promise<RunIntakePipelineResult> => {
  /** ① 解析 + 兜底：无 `{` 且含问号→散文 clarify；否则 defaultClarify（禁止口语猜 chitchat） */
  const parsed = parseIntakeDecision(input.intakeRaw);
  const noJsonObject = !input.intakeRaw.includes("{");
  const proseClarify =
    parsed === null && noJsonObject
      ? clarifyFallbackFromProse(input.intakeRaw)
      : null;
  const parseUsedFallback = parsed === null && proseClarify === null;
  let decision =
    parsed ?? proseClarify ?? defaultIntakeDecision(input.userQuestion);

  logAgentOut("IntakeCoordinator", "解析LLM输出", {
    parseOk: parsed !== null,
    ...(parsed === null
      ? {
          fallbackReason: proseClarify
            ? "无 JSON 对象且含问号 → clarifyFallbackFromProse"
            : "JSON 解析失败 → defaultIntakeDecision(clarify)",
        }
      : {}),
    ...summarizeDecision(decision),
  });

  /** ②a continuation：恒 noop（指代归 LLM + node merge） */
  decision = applyIntakeContinuationGuard(
    decision,
    input.userQuestion,
    input.intakeHistory
  );

  /** ② clarify 早退 */
  if (decision.intent === "clarify") {
    const clarifyEarlyExit = isClarifyEarlyExit(decision);
    logAgentOut("IntakeCoordinator", "LLM指代决策", {
      earlyExit: clarifyEarlyExit,
      ...summarizeDecision(decision),
    });
    if (clarifyEarlyExit) {
      const routed = buildEarlyExitRoutedDecision(decision);
      logAgentOut("IntakeCoordinator", "最终路由", {
        earlyExit: true,
        reason: "clarify",
        ...summarizeDecision(routed),
      });
      return { decision: routed, parseUsedFallback, earlyExit: true };
    }
  }

  /** ③ 闲聊：仅 chitchat intent 注入 briefReply */
  if (decision.intent === "chitchat") {
    const beforeChitchat = decision;
    decision = applyIntakeChitchatGuard(decision);
    logAgentOut("IntakeCoordinator", "guard_闲聊", {
      changed: guardChanged(beforeChitchat, decision),
      ...summarizeDecision(decision),
    });
  }

  /** ③b 非检索 intent 早退 → respondEarly */
  if (isRespondEarlyIntent(decision)) {
    const routed = buildEarlyExitRoutedDecision(decision);
    logAgentOut("IntakeCoordinator", "最终路由", {
      earlyExit: true,
      reason: decision.intent,
      ...summarizeDecision(routed),
    });
    return { decision: routed, parseUsedFallback, earlyExit: true };
  }

  /** ④ 用户记忆：remember/recall → userFact；无效 recall 见下 */
  if (isUserFactIntent(decision.intent)) {
    const factKey = decision.userFactKey?.trim() ?? "";
    /**
     * 无效 recall（缺 userFactKey）：
     * - 已有可用 pathPlan → 改成 retrieve（不发明槽）
     * - pathPlan 为空 → clarify 早退
     */
    if (decision.intent === "recall_user_fact" && !factKey) {
      const pathPlan = legalizePathPlan(decision.pathPlan);
      if (!isPathPlanEmpty(pathPlan)) {
        decision = {
          ...decision,
          intent: "retrieve_and_answer",
          pathPlan,
          userFactKey: null,
          userFactLabel: null,
          userFactValue: null,
          clarifyingQuestion: null,
          briefReply: null,
        };
        logAgentOut("IntakeCoordinator", "guard_用户记忆", {
          matched: false,
          remapped: "invalid_recall_keep_path_plan",
          ...summarizeDecision(decision),
        });
      } else {
        decision = emptyPlanClarify(decision);
        decision = {
          ...decision,
          clarifyingQuestion:
            decision.clarifyingQuestion?.trim() ||
            "你想回忆哪一条个人设定？请说明关键词（例如昵称、偏好）。",
        };
        logAgentOut("IntakeCoordinator", "guard_用户记忆", {
          matched: false,
          remapped: "invalid_recall_to_clarify",
          ...summarizeDecision(decision),
        });
        const routed = buildEarlyExitRoutedDecision(decision);
        logAgentOut("IntakeCoordinator", "最终路由", {
          earlyExit: true,
          reason: "clarify",
          ...summarizeDecision(routed),
        });
        return { decision: routed, parseUsedFallback, earlyExit: true };
      }
    } else {
      logAgentOut("IntakeCoordinator", "guard_用户记忆", {
        matched: true,
        intent: decision.intent,
        userFactKey: decision.userFactKey,
        userFactLabel: decision.userFactLabel,
        hasValue: Boolean(decision.userFactValue?.trim()),
      });
      const routed = buildEarlyExitRoutedDecision(decision);
      logAgentOut("IntakeCoordinator", "最终路由", {
        earlyExit: true,
        reason: decision.intent,
        ...summarizeDecision(routed),
      });
      return { decision: routed, parseUsedFallback, earlyExit: true };
    }
  }

  /** ⑤ 对外链接：字段自相矛盾 harmonize（不发明 multipart） */
  const afterLinkLookup = applyIntakeLinkLookupGuard(
    decision,
    input.userQuestion
  );
  if (afterLinkLookup.linkLookupGuardReason !== "noop") {
    logAgentOut("IntakeCoordinator", "guard_对外链接", {
      reason: afterLinkLookup.linkLookupGuardReason,
      ...summarizeDecision(afterLinkLookup),
    });
  }
  decision = afterLinkLookup;

  /** ⑥ 合法化 LLM pathPlan；retrieve 且空 → clarify */
  let pathPlan = legalizePathPlan(decision.pathPlan);

  // 顶层 userFactKey 补到缺 key 的 mem 步（结构补全，非猜字段名）
  if (decision.userFactKey?.trim()) {
    const topKey = decision.userFactKey.trim();
    pathPlan = {
      steps: pathPlan.steps.map((s) =>
        s.kind === "mem" && !s.userFactKey
          ? {
              ...s,
              userFactKey: topKey,
              userFactLabel:
                s.userFactLabel || decision.userFactLabel || s.label,
            }
          : s
      ),
    };
  }

  const pathPlanBeforeMemRecall = pathPlan;
  pathPlan = ensureMemRecallStepFromTopUserFact(decision, pathPlan);
  if (pathPlan.steps.length !== pathPlanBeforeMemRecall.steps.length) {
    logAgentOut("IntakeCoordinator", "guard_顶层userFactKey→mem步", {
      userFactKey: decision.userFactKey,
      userFactLabel: decision.userFactLabel,
      memStepId: pathPlan.steps.find((s) => s.kind === "mem")?.id ?? null,
    });
  }

  // 结构规则：仅一步 mem → 等价纯 recall 早退（缺 key 时用占位 key + Intake label）
  if (
    decision.intent === "retrieve_and_answer" &&
    pathPlan.steps.length === 1 &&
    pathPlan.steps[0]?.kind === "mem"
  ) {
    const mem = pathPlan.steps[0];
    const label =
      mem.userFactLabel?.trim() ||
      decision.userFactLabel?.trim() ||
      mem.label ||
      "user_fact";
    const factKey =
      mem.userFactKey?.trim() ||
      decision.userFactKey?.trim() ||
      normalizeFactKey(mem.userFactLabel ?? "") ||
      normalizeFactKey(mem.label) ||
      normalizeFactKey(mem.searchQuery) ||
      "user_fact";
    decision = {
      ...decision,
      intent: "recall_user_fact",
      userFactKey: factKey,
      userFactLabel: label,
      userFactValue: null,
      pathPlan: emptyPathPlan(),
      retrievalPlan: [],
      composeMode: "qa",
    };
    logAgentOut("IntakeCoordinator", "guard_单步mem→recall", {
      userFactKey: decision.userFactKey,
      userFactLabel: decision.userFactLabel,
    });
    const routed = buildEarlyExitRoutedDecision(decision);
    logAgentOut("IntakeCoordinator", "最终路由", {
      earlyExit: true,
      reason: "recall_user_fact",
      ...summarizeDecision(routed),
    });
    return { decision: routed, parseUsedFallback, earlyExit: true };
  }

  const needsPathPlan =
    decision.intent === "retrieve_and_answer" ||
    (decision.intent === "summarize_content" &&
      decision.searchQuery.trim().length > 0);

  if (needsPathPlan && isPathPlanEmpty(pathPlan)) {
    decision = emptyPlanClarify(decision);
    logAgentOut("IntakeCoordinator", "guard_PathPlan", {
      reason: "empty_path_plan_to_clarify",
      ...summarizeDecision(decision),
    });
    const routed = buildEarlyExitRoutedDecision(decision);
    logAgentOut("IntakeCoordinator", "最终路由", {
      earlyExit: true,
      reason: "clarify",
      ...summarizeDecision(routed),
    });
    return { decision: routed, parseUsedFallback, earlyExit: true };
  }

  const answerOrder = legalizeAnswerOrder(decision.answerOrder, pathPlan);
  pathPlan = reorderPathPlanByAnswerOrder(pathPlan, answerOrder);
  const composeMode =
    decision.intent === "summarize_content"
      ? "summarize"
      : legalizeComposeMode(decision.composeMode, pathPlan);

  logAgentOut("IntakeCoordinator", "guard_PathPlan", {
    reason: "legalized",
    composeMode,
    answerOrder: pathPlan.steps.map((s) => s.id),
    steps: pathPlan.steps.map((s) => ({
      id: s.id,
      kind: s.kind,
      queryType: s.queryType,
      toolId: s.toolId ?? null,
    })),
    km: pathPlan.steps.filter((s) => s.kind === "km").length,
    list: pathPlan.steps.filter((s) => s.kind === "list").length,
    mem: pathPlan.steps.filter((s) => s.kind === "mem").length,
    tool: pathPlan.steps.filter((s) => s.kind === "tool").length,
    summarize: pathPlan.steps.filter((s) => s.kind === "summarize").length,
    dag: pathPlan.steps.filter((s) => s.kind === "dag").map((d) => d.template),
  });

  /** ⑦ list 步补页码（从 history blocks） */
  const paginationHistory = input.history ?? input.intakeHistory;
  pathPlan = fillListPagesInPathPlan(pathPlan, paginationHistory);

  /** ⑧ 按 steps 顺序派生 compositeSlots / retrievalPlan；hybrid DAG 展开 */
  const finalAnswerOrder = pathPlan.steps.map((s) => s.id);
  const compositeSlots = deriveCompositeSlotsFromPathPlan(pathPlan);
  const retrievalPlan = deriveRetrievalPlanFromPathPlan(pathPlan);
  const executionPlan = executionPlanFromPathPlanDag(
    pathPlan,
    input.userQuestion,
    decision.searchQuery
  );

  const listSlots = compositeSlots.filter((s) => s.executor === "list_corpus");
  const firstList = listSlots.length > 0 ? listSlots[0] : null;
  const listIntent = firstList?.enumerationControl?.action ?? null;

  if (listSlots.length > 0) {
    logAgentOut("IntakeCoordinator", "guard_列举分页", {
      listSlotCount: listSlots.length,
      listIntent,
      page: firstList?.enumerationPage,
      pageSize: firstList?.enumerationPageSize,
      listKind: firstList?.enumerationControl?.listKind ?? null,
      slotExecutors: compositeSlots.map((s) => ({
        id: s.id,
        executor: s.executor ?? "km_retrieve",
        action: s.enumerationControl?.action ?? null,
      })),
    });
  }

  if (executionPlan) {
    logAgentOut("IntakeCoordinator", "guard_工具计划", {
      executionPlanCount: executionPlan.length,
      dagTemplates: pathPlan.steps
        .filter((d) => d.kind === "dag")
        .map((d) => d.template),
      compositeSlotCount: compositeSlots.length,
    });
  }

  const routed: RoutedIntakeDecision = {
    ...decision,
    pathPlan,
    answerOrder: finalAnswerOrder,
    composeMode,
    retrievalPlan,
    compositeSlots,
    routeMode: "planFanOut",
    routeReason: "intake_path_plan",
    routePlanSource: "intake_path_plan",
    executionPlan,
    listIntent:
      listIntent === "continue" || listIntent === "exhaustive"
        ? listIntent
        : listIntent === "preview"
          ? "preview"
          : null,
    enumerationPage: firstList?.enumerationPage,
    enumerationPageSize: firstList?.enumerationPageSize,
    enumerationListKind: firstList?.enumerationControl?.listKind,
  };
  routed.routeMode = resolveIntakeGraphRouteMode(routed);

  /** ⑨ 出口 */
  logAgentOut("IntakeCoordinator", "最终路由", {
    ...summarizeDecision(routed),
    composeMode: routed.composeMode,
    pathPlanCounts: {
      km: routed.pathPlan.steps.filter((s) => s.kind === "km").length,
      list: routed.pathPlan.steps.filter((s) => s.kind === "list").length,
      mem: routed.pathPlan.steps.filter((s) => s.kind === "mem").length,
      tool: routed.pathPlan.steps.filter((s) => s.kind === "tool").length,
      summarize: routed.pathPlan.steps.filter((s) => s.kind === "summarize")
        .length,
      dag: routed.pathPlan.steps.filter((s) => s.kind === "dag").length,
    },
  });
  return { decision: routed, parseUsedFallback, earlyExit: false };
};
