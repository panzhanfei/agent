/**
 * 可选 LLM 填充 MatchReport（结构化 JSON）；失败则由调用方回退确定性模板。
 * SYNTHESIZE_MATCH_LLM=0 时跳过。
 */
import { completeChat } from "@fambrain/brain-shared/chat";
import { recordCompleteChatUsage } from "@fambrain/brain-shared/pipeline-run-context";
import { parseJsonObject } from "@/agentflow/utils";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import { parseMatchReport } from "./match-report";
import type { MatchReport } from "./interface";

const SYSTEM = `你是多源对照评估器。只输出一个 JSON 对象，不要 Markdown，不要解释。
字段：
- matches: [{text, evidence?}] 材料对齐的要点（有证据才写）
- gaps: [{text, evidence?}] 缺口
- risks: [{text, evidence?}] 风险或不确定（来源弱、过时、证据不足）
- conclusion: 仅允许 "适合" | "谨慎" | "信息不足"
- evidenceGrade: "sufficient" | "partial" | "insufficient"
- sourcesUsed: ["corpus" 和/或 "web"]
- openQuestions?: string[] 还缺什么信息

规则：
1. 禁止编造材料中未出现的事实。
2. 材料不足时 conclusion 必须为「信息不足」或「谨慎」，evidenceGrade 相应降级。
3. conclusion 必须是三选一枚举，禁止散文句。`;

const FREE_SYSTEM = `你是多源汇合器。根据 goal 与材料写一段直接回答用户的正文。
规则：
1. 只依据材料，禁止编造材料中没有的事实。
2. 默认不要输出「## 匹配点 / ## 缺口 / ## 风险 / ## 结论」招聘四栏。
3. 材料不足就说明缺什么，不要假装评估岗位匹配。`;

export const fillFreeSynthesisWithLlm = async (input: {
  label: string;
  deps: ToolRunResult[];
  userQuestion?: string;
}): Promise<string | null> => {
  if (process.env.SYNTHESIZE_MATCH_LLM === "0") return null;
  const materials = {
    goal: input.label,
    userQuestion: input.userQuestion ?? null,
    sources: input.deps.map((d) => ({
      label: d.label,
      toolId: d.toolId,
      ok: d.ok,
      answer: d.answer?.slice(0, 1200) ?? null,
    })),
  };
  try {
    const promptText = JSON.stringify(materials, null, 2);
    const resultChat = await completeChat({
      messages: [
        { role: "system", content: FREE_SYSTEM },
        { role: "user", content: promptText },
      ],
      thinking: "disabled",
      temperature: 0,
    });
    recordCompleteChatUsage(resultChat.usage, {
      promptText,
      completionText: resultChat.text,
      node: "plan_dag",
    });
    const text = resultChat.text.trim();
    return text || null;
  } catch {
    return null;
  }
};

export const fillMatchReportWithLlm = async (input: {
  label: string;
  deps: ToolRunResult[];
  userQuestion?: string;
}): Promise<MatchReport | null> => {
  if (process.env.SYNTHESIZE_MATCH_LLM === "0") return null;

  const resume = input.deps.find((d) => d.toolId === "retrieve_corpus");
  const webs = input.deps.filter((d) => d.toolId === "search_web");
  const materials = {
    label: input.label,
    userQuestion: input.userQuestion ?? null,
    resume: resume?.answer?.slice(0, 1200) ?? null,
    web: webs.map((w) => ({
      label: w.label,
      ok: w.ok,
      answer: w.answer?.slice(0, 1000) ?? null,
    })),
  };

  try {
    const promptText = JSON.stringify(materials, null, 2);
    const resultChat = await completeChat({
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: promptText },
      ],
      jsonMode: true,
      thinking: "disabled",
      temperature: 0,
    });
    recordCompleteChatUsage(resultChat.usage, {
      promptText,
      completionText: resultChat.text,
      node: "plan_dag",
    });
    if (!resultChat.text.trim()) {
      return null;
    }
    const obj = parseJsonObject(resultChat.text);
    return parseMatchReport(obj);
  } catch {
    return null;
  }
};
