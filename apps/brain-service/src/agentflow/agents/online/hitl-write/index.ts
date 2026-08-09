/** HITL 语料写盘：提案 → interrupt → 确认后快照+写盘+按 path 向量 */

export type {
  CorpusEditApplyResult,
  CorpusEditOperation,
  CorpusEditProposalView,
  CorpusEditResumeAction,
} from "./interface";

export {
  CORPUS_EDIT_ACTION,
  corpusEditApprovePrompt,
  corpusEditDetailPrompt,
  corpusEditDismissEditPrompt,
  corpusEditOpenFilePrompt,
  corpusEditRejectPrompt,
  corpusEditStaleGroupKey,
  matchCorpusEditUiPrompt,
  type CorpusEditUiAction,
} from "./actions";

export {
  fileExists,
  normalizeRepoPath,
  resolveCorpusMarkdownAbsPath,
} from "./paths";

export {
  parseEditOperation,
  proposeCorpusEdit,
  targetPathFromStep,
} from "./propose";

export { proposeCorpusEditFromApi } from "./propose-from-api";

export { previewCorpusMarkdown } from "./preview";

export {
  applyCorpusEditProposal,
  rejectCorpusEditProposal,
} from "./apply";

export {
  getCompiledCorpusEditGraph,
  resumeCorpusEditGraph,
  startCorpusEditGraph,
} from "./graph";

export { resumeCorpusEdit } from "./resume";

export {
  CORPUS_EDIT_PENDING_TTL_MS,
  ensureProposalNotStale,
  expirePendingOnNewConversation,
  loadActionableProposal,
} from "./lifecycle";

export {
  buildCorpusEditAppliedActions,
  buildCorpusEditAppliedAnswer,
  buildCorpusEditDetailAnswer,
  buildCorpusEditDismissEditAnswer,
  buildCorpusEditOpenAnswer,
  buildCorpusEditPendingActions,
  buildCorpusEditPendingAnswer,
  buildCorpusEditReviewActions,
} from "./compose-actions";

export { corpusEditErrorMessage } from "./errors";

export { runCorpusEditSlotWorker } from "./slot";
export { resolveCorpusEditUiBypass } from "./intake-bypass";

import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { emitBudgetedSlotPatch } from "@/agentflow/agents/online/plan-fanout/slot-budget";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { runCorpusEditSlotWorker } from "./slot";

/** LangGraph `corpusEdit` 节点：Send 工人 */
export const runCorpusEditNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("HitlWrite", "进入", {
    via: "corpusEdit",
    slotId: state.activeSlotId,
  });

  const out = await emitBudgetedSlotPatch(state, "corpus_edit", () =>
    runCorpusEditSlotWorker(state)
  );
  const patch = out.fanOutSlotPatches?.[0];

  logAgentOut("HitlWrite", "出去", {
    via: "corpusEdit",
    slotId: patch?.slotId ?? state.activeSlotId,
    slotStatus: patch?.slotRuntime?.status ?? null,
    notesPreview: patch?.sub.notes?.slice(0, 120) ?? null,
  });

  return out;
};
