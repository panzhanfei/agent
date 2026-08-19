/**
 * save HITL：一次 interrupt；确认写盘或取消。
 */
import { interrupt } from "@langchain/langgraph";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import {
  rememberVaultWorkspaceOp,
  runVaultWorkspaceOp,
  takeCachedVaultWorkspaceOp,
} from "../vault";
import type { FileGraphState } from "../graph/state";
import { sanitizeVaultSaveBasename } from "./filename";
import type { VaultSaveGateBlocks, VaultSaveResume } from "./interface";
import {
  VAULT_SAVE_CANCEL_PROMPT,
  VAULT_SAVE_CONFIRM_PROMPT,
} from "./interface";

export type { VaultSaveGateBlocks, VaultSaveResume } from "./interface";
export {
  VAULT_SAVE_CANCEL_PROMPT,
  VAULT_SAVE_CONFIRM_PROMPT,
} from "./interface";
export {
  sanitizeVaultSaveBasename,
  suggestedVaultSaveBasename,
} from "./filename";

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
  language?: "zh" | "en";
}): VaultSaveGateBlocks => {
  const zh = input.language !== "en";
  const hint = zh
    ? "可将本轮终稿写入原文库（.txt）。点「确定入库」后填写文件名。"
    : "Save this draft to the workspace as a .txt file.";
  return {
    answer: hint,
    blocks: [
      { type: "text", markdown: hint },
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

export const runSaveHitlNode = async (
  state: FileGraphState
): Promise<Partial<FileGraphState>> => {
  logAgentOut("FileAgent", "进入 save HITL", { via: "saveHitl" });
  const draft = state.envelope.draft.trim();
  if (!draft) {
    return {
      result: { action: "noop", answer: "" },
    };
  }
  const language = state.language;
  const built = buildVaultSaveGateBlocks({ language });
  const conversationId = state.conversationId;

  for (;;) {
    const resume: unknown = interrupt({
      kind: "vault_wait",
      answer: built.answer,
      blocks: built.blocks,
    });
    const parsed = parseVaultSaveResume(resume);
    if (parsed.kind === "cancel") {
      logAgentOut("FileAgent", "写回取消", { via: "saveHitl" });
      return {
        answer: built.answer,
        assistantBlocks: null,
        result: { action: "cancelled", answer: built.answer },
      };
    }
    if (parsed.kind === "confirm") {
      const fileName = `${parsed.name}.txt`;
      const params = {
        operation: "create_file" as const,
        targetPath: "",
        name: fileName,
        afterContent: draft,
      };
      let opResult = takeCachedVaultWorkspaceOp(conversationId, params);
      if (!opResult) {
        opResult = await runVaultWorkspaceOp({
          corpusUserId: state.corpusUserId,
          params,
          language,
        });
        rememberVaultWorkspaceOp(conversationId, params, opResult);
      }
      const note = opResult.ok
        ? language === "en"
          ? `Saved as ${fileName}. ${opResult.syncNote ?? ""}`.trim()
          : `已入库为 ${fileName}。${opResult.syncNote ?? ""}`.trim()
        : opResult.answer;
      logAgentOut("FileAgent", "写回完成", {
        via: "saveHitl",
        ok: opResult.ok,
        name: fileName,
      });
      return {
        answer: note,
        assistantBlocks: null,
        result: {
          action: opResult.ok ? "saved" : "error",
          answer: note,
          savedPath: opResult.ok ? fileName : undefined,
        },
      };
    }
  }
};
