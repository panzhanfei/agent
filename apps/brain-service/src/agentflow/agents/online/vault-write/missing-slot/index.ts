/**
 * 缺槽：vault 独占，不写 Join 补丁；带 answer 落到 persistTurnEnd。
 */
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

/** 包根判定没槽之后调用：不再 resolve 一次、也不跑 op。 */
export const missingVaultWorkspaceSlotState = (): Partial<PipelineGraphState> => {
  const error = "缺少 activeSlotId";
  return { answer: error, error };
};
