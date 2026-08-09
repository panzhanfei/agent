import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import { parseIntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import { parseJsonObject } from "@/agentflow/utils";

export const parseIntakeDecision = (
  raw: string
): IntakeRoutingDecision | null => {
  const parsed = parseJsonObject<unknown>(raw);
  if (!parsed) return null;
  return parseIntakeRoutingDecision(parsed);
};

/**
 * LLM 未吐 JSON、而是散文时的结构兜底（无口语意图词表）。
 * 信号：无 `{`/`}`；含问号 → 当作 clarify 文案。
 */
export const clarifyFallbackFromProse = (
  raw: string
): IntakeRoutingDecision | null => {
  const t = raw.trim();
  if (!t || t.length < 8 || t.length > 400) return null;
  if (t.includes("{") || t.includes("}")) return null;
  if (!/[？?]/.test(t)) return null;
  return {
    intent: "clarify",
    searchQuery: "",
    subTasks: [],
    topics: [],
    language: "zh",
    confidence: 0.55,
    queryType: null,
    clarifyingQuestion: t.slice(0, 240),
    briefReply: null,
    retrievalPlan: [],
    pathPlan: { steps: [] },
    answerOrder: [],
    composeMode: "qa",
    userFactKey: null,
    userFactLabel: null,
    userFactValue: null,
    attachmentAction: null,
    coreference: "none",
  };
};

/** Intake JSON 解析失败：clarify，不瞎 retrieve / 不发明空 plan */
export const defaultIntakeDecision = (
  _userQuestion: string
): IntakeRoutingDecision => ({
  intent: "clarify",
  searchQuery: "",
  subTasks: [],
  topics: [],
  language: "zh",
  confidence: 0.4,
  queryType: null,
  clarifyingQuestion: "刚才没听清，请再说一次你想了解什么？",
  briefReply: null,
  retrievalPlan: [],
  pathPlan: { steps: [] },
  answerOrder: [],
  composeMode: "qa",
  userFactKey: null,
  userFactLabel: null,
  userFactValue: null,
  attachmentAction: null,
  coreference: "none",
});
