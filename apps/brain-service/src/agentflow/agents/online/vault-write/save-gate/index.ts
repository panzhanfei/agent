/**
 * vaultSaveGate：Analyst / Summarizer 之后一次 interrupt。
 * 弹窗确认后 create_file + materialize；取消不写盘。不进 Join。
 */
import { interrupt } from "@langchain/langgraph";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import {
  rememberVaultWorkspaceOp,
  runVaultWorkspaceOp,
  takeCachedVaultWorkspaceOp,
} from "../ops";
import { sanitizeVaultSaveBasename } from "./filename";
import type { VaultSaveGateBlocks, VaultSaveResume } from "./interface";
import {
  VAULT_SAVE_CANCEL_PROMPT,
  VAULT_SAVE_CONFIRM_PROMPT,
} from "./interface";

export type { VaultSaveResume } from "./interface";
export {
  VAULT_SAVE_CANCEL_PROMPT,
  VAULT_SAVE_CONFIRM_PROMPT,
} from "./interface";
export {
  sanitizeVaultSaveBasename,
  suggestedVaultSaveBasename,
} from "./filename";

/** 摘要终稿或附件翻译/总结：出闸门。普通 QA / extract 不出。 */
export const shouldOfferVaultSaveGate = (
  state: Pick<PipelineGraphState, "answer" | "error" | "decision">
): boolean => {
  if (state.error) return false;
  if (!state.answer?.trim()) return false;
  const d = state.decision;
  if (!d) return false;
  if (d.composeMode === "summarize" || d.intent === "summarize_content") {
    return true;
  }
  return (
    d.attachmentAction === "translate" || d.attachmentAction === "summarize"
  );
};

export const parseVaultSaveResume = (resume: unknown): VaultSaveResume => {
  if (!resume || typeof resume !== "object") return { kind: "unknown" };
  const r = resume as { kind?: unknown; prompt?: unknown; name?: unknown };
  if (r.kind !== "vault_action" || typeof r.prompt !== "string") {
    return { kind: "unknown" };
  }
  const prompt = r.prompt.trim();
  if (prompt === VAULT_SAVE_CANCEL_PROMPT) return { kind: "cancel" };
  const isConfirm =
    prompt === VAULT_SAVE_CONFIRM_PROMPT ||
    prompt.startsWith(`${VAULT_SAVE_CONFIRM_PROMPT}:`);
  if (!isConfirm) return { kind: "unknown" };
  const fromPayload = typeof r.name === "string" ? r.name : "";
  const fromPrompt = prompt.startsWith(`${VAULT_SAVE_CONFIRM_PROMPT}:`)
    ? prompt.slice(VAULT_SAVE_CONFIRM_PROMPT.length + 1)
    : "";
  const name = sanitizeVaultSaveBasename(fromPayload || fromPrompt);
  if (!name) return { kind: "unknown" };
  return { kind: "confirm", name };
};

export const buildVaultSaveGateBlocks = (input: {
  draft: string;
  language?: "zh" | "en";
}): VaultSaveGateBlocks => {
  const zh = input.language !== "en";
  const hint = zh
    ? `${input.draft.trim()}\n\n可将本轮终稿写入原文库（.txt）。点「确定入库」后填写文件名。`
    : `${input.draft.trim()}\n\nSave this draft to the workspace as a .txt file.`;
  return {
    answer: hint,
    blocks: [
      { type: "text", markdown: input.draft.trim() },
      {
        type: "actions",
        actions: [
          {
            id: "vault-save-confirm",
            label: zh ? "确定入库" : "Save",
            prompt: VAULT_SAVE_CONFIRM_PROMPT,
            displayText: zh ? "确定入库" : "Save to workspace",
            clientHandler: "vault_save_name",
          },
          {
            id: "vault-save-cancel",
            label: zh ? "取消" : "Cancel",
            prompt: VAULT_SAVE_CANCEL_PROMPT,
            displayText: zh ? "取消入库" : "Skip save",
          },
        ],
      },
    ],
  };
};

export const runVaultSaveGateNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("VaultWrite", "进入", { via: "vaultSaveGate" });
  const draft = state.answer?.trim() ?? "";
  if (!draft) {
    return {};
  }
  const language = state.decision?.language === "en" ? "en" : "zh";
  const built = buildVaultSaveGateBlocks({ draft, language });
  const conversationId = state.context.conversationId;

  for (;;) {
    const resume: unknown = interrupt({
      kind: "vault_wait",
      answer: built.answer,
      blocks: built.blocks,
    });
    const parsed = parseVaultSaveResume(resume);
    if (parsed.kind === "cancel") {
      logAgentOut("VaultWrite", "写回取消", { via: "vaultSaveGate" });
      return { answer: draft, assistantBlocks: null };
    }
    if (parsed.kind === "confirm") {
      const fileName = `${parsed.name}.txt`;
      const params = {
        operation: "create_file" as const,
        targetPath: "",
        name: fileName,
        afterContent: draft,
      };
      let result = takeCachedVaultWorkspaceOp(conversationId, params);
      if (!result) {
        result = await runVaultWorkspaceOp({
          corpusUserId: state.context.corpusUserId,
          params,
          language,
        });
        rememberVaultWorkspaceOp(conversationId, params, result);
      }
      const note = result.ok
        ? language === "en"
          ? `Saved as ${fileName}. ${result.syncNote ?? ""}`.trim()
          : `已入库为 ${fileName}。${result.syncNote ?? ""}`.trim()
        : result.answer;
      logAgentOut("VaultWrite", "写回完成", {
        via: "vaultSaveGate",
        ok: result.ok,
        name: fileName,
      });
      return {
        answer: `${draft}\n\n${note}`,
        assistantBlocks: null,
      };
    }
  }
};
