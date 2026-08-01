import type { AgentPipelineContext } from "@fambrain/brain-types";
import { logAgentIn, logAgentOut } from "@fambrain/brain-shared/agent-log";
import { addStructuredUserFact, getMemoryConfig } from "@fambrain/brain-memory";
import { getUserMemoryAutoLearnConfig } from "./config";
import { extractUserMemoryFactsFromUtterance } from "./extract";

/**
 * 轮次结束静默自学：用户原话 → 结构化 facts → Mem0（写时去重）。
 * 不写 corpus、不进 pending、不打扰用户。
 */
export const persistUserMemoryAutoLearnAfterTurn = async (input: {
  context: AgentPipelineContext;
  userQuestion: string;
  /** 本轮已有显式 remember/recall 时跳过，避免叠写 */
  skipBecauseExplicitUserFact?: boolean;
}): Promise<{ wrote: number }> => {
  const cfg = getUserMemoryAutoLearnConfig();
  if (!cfg.enabled) return { wrote: 0 };
  if (input.skipBecauseExplicitUserFact) return { wrote: 0 };

  const memCfg = getMemoryConfig();
  if (!memCfg.mem0Enabled) return { wrote: 0 };

  const q = input.userQuestion.trim();
  if (!q) return { wrote: 0 };

  logAgentIn("UserMemoryExtract", "进入", {
    action: "persist_after_turn",
    conversationId: input.context.conversationId,
  });

  const facts = await extractUserMemoryFactsFromUtterance(q);
  if (facts.length === 0) {
    logAgentOut("UserMemoryExtract", "出去", {
      action: "persist_after_turn",
      wrote: 0,
    });
    return { wrote: 0 };
  }

  let wrote = 0;
  for (const fact of facts) {
    try {
      const result = await addStructuredUserFact({
        userId: input.context.actorUserId,
        factKey: fact.factKey,
        label: fact.label,
        value: fact.value,
        source: "auto_learn",
      });
      if (result === "added" || result === "replaced") wrote += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn("[UserMemoryExtract] mem0 write failed:", message);
    }
  }

  logAgentOut("UserMemoryExtract", "出去", {
    action: "persist_after_turn",
    candidateCount: facts.length,
    wrote,
  });
  return { wrote };
};
