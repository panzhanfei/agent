/**
 * 原文库工作台循环：op → interrupt → Resume。点「结束」则 return。
 */
import { interrupt } from "@langchain/langgraph";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { FileGraphState } from "../graph/state";
import { nextFromResume } from "./intake";
import type { VaultWorkspaceParams } from "../vault";
import {
  rememberVaultWorkspaceOp,
  runVaultWorkspaceOp,
  takeCachedVaultWorkspaceOp,
  vaultWorkspaceDoneReply,
  withVaultHitlDone,
} from "../vault";

export {
  buildVaultWorkspaceUiDecision,
  matchVaultWorkspaceUiAction,
  nextFromResume,
  resolveVaultWorkspaceUiBypass,
  toVaultWorkspaceParams,
} from "./intake";

export const runWorkspaceNode = async (
  state: FileGraphState
): Promise<Partial<FileGraphState>> => {
  logAgentOut("FileAgent", "进入 workspace", { via: "workspace" });

  let params: VaultWorkspaceParams = state.workspaceParams ??
    state.envelope.workspaceOp ?? {
      operation: "list",
      targetPath: "",
    };
  const language = state.language;
  const conversationId = state.conversationId;

  for (;;) {
    let opResult = takeCachedVaultWorkspaceOp(conversationId, params);
    if (!opResult) {
      opResult = await runVaultWorkspaceOp({
        corpusUserId: state.corpusUserId,
        params,
        language,
      });
      rememberVaultWorkspaceOp(conversationId, params, opResult);
    }
    const resume: unknown = interrupt({
      kind: "vault_wait",
      answer: opResult.answer,
      blocks: withVaultHitlDone(opResult.blocks ?? [], language),
    });
    const next = nextFromResume(resume, params);
    if (next.kind === "done") {
      const answer = vaultWorkspaceDoneReply(language);
      return {
        answer,
        assistantBlocks: null,
        result: { action: "workspace_done", answer },
      };
    }
    params = next.params;
  }
};
