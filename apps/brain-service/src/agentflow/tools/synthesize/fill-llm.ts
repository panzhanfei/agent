/**
 * 可选 LLM 填充 MatchReport（结构化 JSON）；失败则由调用方回退确定性模板。
 * SYNTHESIZE_MATCH_LLM=0 时跳过。
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOllama } from "@langchain/ollama";
import { getBrainServiceConfig } from "@fambrain/brain-config";
import { recordLangChainOllamaUsage } from "@fambrain/brain-shared/pipeline-run-context";
import { parseJsonObject, textFromResponse } from "@/agentflow/utils";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import { parseMatchReport } from "./match-report";
import type { MatchReport } from "./interface";

const SYSTEM = `你是「履历×公司/市场」匹配评估器。只输出一个 JSON 对象，不要 Markdown，不要解释。
字段：
- matches: [{text, evidence?}] 履历与公司/岗位对齐的要点（有证据才写）
- gaps: [{text, evidence?}] 缺口
- risks: [{text, evidence?}] 风险或不确定（外搜弱、过时、证据不足）
- conclusion: 仅允许 "适合" | "谨慎" | "信息不足"
- evidenceGrade: "sufficient" | "partial" | "insufficient"
- sourcesUsed: ["corpus" 和/或 "web"]
- openQuestions?: string[] 还缺什么信息

规则：
1. 禁止编造材料中未出现的事实。
2. 外网或履历缺失时 conclusion 必须为「信息不足」或「谨慎」，evidenceGrade 相应降级。
3. conclusion 必须是三选一枚举，禁止散文句。`;

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

  const { ollama } = getBrainServiceConfig();
  const llm = new ChatOllama({
    baseUrl: ollama.baseUrl,
    model: ollama.models.intakeCoordinator,
    temperature: 0,
  });

  try {
    const messages = [
      new SystemMessage(SYSTEM),
      new HumanMessage(JSON.stringify(materials, null, 2)),
    ];
    const promptText = JSON.stringify(materials);
    const res = await llm.invoke(messages);
    const text = textFromResponse(res.content);
    recordLangChainOllamaUsage(res, {
      promptText,
      completionText: text,
      node: "plan_dag",
    });
    if (!text.trim()) {
      return null;
    }
    const obj = parseJsonObject(text);
    return parseMatchReport(obj);
  } catch {
    return null;
  }
};
