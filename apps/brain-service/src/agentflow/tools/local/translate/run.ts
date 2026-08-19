import { runWithToolContext } from "../../context";
import type { ToolRunResult } from "@/agentflow/agents/online/tool-orchestrator/interface";
import { translateTextTool } from "./translate-text";

export const runTranslateText = async (input: {
  corpusUserId: string;
  actorUserId: string;
  text: string;
  targetLang: string;
  sourceLang?: string | null;
  label: string;
}): Promise<ToolRunResult> => {
  const raw = await runWithToolContext(
    { corpusUserId: input.corpusUserId, actorUserId: input.actorUserId },
    () =>
      translateTextTool.invoke({
        text: input.text,
        targetLang: input.targetLang,
        sourceLang: input.sourceLang ?? undefined,
      })
  );
  const parsed = JSON.parse(String(raw)) as {
    status: string;
    text: string;
    targetLang: string;
    sourceLang: string;
    translation?: string;
    message?: string;
  };
  const ok = parsed.status === "ok" && Boolean(parsed.translation?.trim());
  const answer = ok
    ? parsed.translation!
    : parsed.message ??
      "未配置翻译或翻译失败，请配置 YOUDAO_APP_KEY / YOUDAO_APP_SECRET。";
  return {
    toolId: "translate_text",
    label: input.label || `translate→${input.targetLang}`,
    ok,
    answer,
    citations: [],
    hits: [],
    insufficientEvidence: !ok,
    confidence: ok ? 0.85 : 0.3,
  };
};
