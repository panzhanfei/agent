import type { DbChatTurn } from "@fambrain/brain-types";
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator/guards/interface";

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
