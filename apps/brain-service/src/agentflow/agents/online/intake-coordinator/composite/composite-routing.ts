/**
 * Composite 结构信号工具（非计划发明）。
 * 主路径槽位来自 pathPlan.steps → deriveCompositeSlotsFromPathPlan。
 */
import type {
  IntakeRetrievalPlanItem,
  IntakeRoutingDecision,
} from "@/agentflow/agents/online/intake-coordinator/contract";

/** 结构信号：多问号 / 顿号并列 / 编号（非语义词表；供 link stale 检测等） */
export const looksLikeMultiPartQuestion = (question: string): boolean => {
  const q = question.trim();
  if (!q) return false;
  if (/^\d+[.．、]\s*[^\d]{2,}$/u.test(q)) return false;
  const questionMarks = (q.match(/[？?]/g) ?? []).length;
  if (questionMarks >= 2) return true;
  if (/[，,、；;]/.test(q)) return true;
  if (/\d[.．、].*\d[.．、]/s.test(q)) return true;
  return false;
};

/** 按问号/分句切开用户句（结构工具；不用于发明 plan） */
export const splitQuestionUnits = (question: string): string[] => {
  const q = question.trim();
  if (!q) return [];
  const parts = q
    .split(/[？?；;]+/)
    .flatMap((chunk) => chunk.split(/[，,、]/))
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  return [...new Set(parts)];
};

const normalizePlanItems = (
  items: IntakeRetrievalPlanItem[]
): IntakeRetrievalPlanItem[] =>
  items.filter(
    (item) => item.label.trim().length > 0 && item.searchQuery.trim().length > 0
  );

export { normalizePlanItems };

/** 信 Intake queryType；null/default → default（不调口语词表） */
export const resolveEffectiveQueryType = (
  _userQuestion: string,
  decision: Pick<
    IntakeRoutingDecision,
    "queryType" | "subTasks" | "searchQuery"
  >
): NonNullable<IntakeRoutingDecision["queryType"]> | "default" => {
  if (decision.queryType && decision.queryType !== "default") {
    return decision.queryType;
  }
  return "default";
};
