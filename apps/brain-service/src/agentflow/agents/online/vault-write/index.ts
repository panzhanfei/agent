/** vault workspace：两层 list + txt/文件夹 CRUD + 语料化钩子 */

export type {
  VaultWorkspaceListResult,
  VaultWorkspaceOp,
  VaultWorkspaceParams,
} from "./interface";
export { VAULT_WORKSPACE_OPS } from "./interface";

export {
  VAULT_WORKSPACE_ACTION,
  VAULT_WORKSPACE_UI_ENTRY,
  matchVaultWorkspaceUiPrompt,
  vaultWsCreateFilePrompt,
  vaultWsCreateFolderPrompt,
  vaultWsDeleteFilePrompt,
  vaultWsDeleteFolderPrompt,
  vaultWsListPrompt,
  vaultWsOpenPrompt,
  type VaultWsUiAction,
} from "./actions";

export { buildVaultWorkspaceListBlocks } from "./compose-actions";

export {
  parseVaultWorkspaceParams,
  purgeOneForTest,
  runVaultWorkspaceOp,
  type VaultWorkspaceRunResult,
} from "./ops";
export {
  resolveVaultWorkspaceUiBypass,
  buildVaultWorkspaceUiDecision,
  matchVaultWorkspaceUiAction,
  toVaultWorkspaceParams,
} from "./intake-bypass";

import { interrupt } from "@langchain/langgraph";
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PipelineResumePayload } from "@/agentflow/execution";
import {
  matchVaultWorkspaceUiPrompt,
  VAULT_WORKSPACE_UI_ENTRY,
} from "./actions";
import { toVaultWorkspaceParams } from "./intake-bypass";
import {
  parseVaultWorkspaceParams,
  runVaultWorkspaceOp,
} from "./ops";
import type { VaultWorkspaceParams } from "./interface";
import {
  rememberVaultWorkspaceOp,
  takeCachedVaultWorkspaceOp,
} from "./op-cache";
import { missingVaultWorkspaceSlotPatch } from "./missing-slot";

const isVaultActionResume = (
  resume: unknown
): resume is PipelineResumePayload => {
  if (!resume || typeof resume !== "object") return false;
  const r = resume as { kind?: unknown; prompt?: unknown };
  return r.kind === "vault_action" && typeof r.prompt === "string";
};

/** 把 Resume 带回的按钮 prompt 收成下一步 VaultWorkspaceParams；认不出则沿用当前 params。 */
const paramsFromResume = (
  resume: unknown,
  fallback: VaultWorkspaceParams
): VaultWorkspaceParams => {
  if (!isVaultActionResume(resume)) return fallback;
  const q = resume.prompt.trim();
  if (!q) return fallback;
  const action =
    q === VAULT_WORKSPACE_UI_ENTRY
      ? ({ type: "list", folderRel: "" } as const)
      : matchVaultWorkspaceUiPrompt(q);
  if (!action) return fallback;
  return toVaultWorkspaceParams(action);
};

/**
 * LangGraph `vaultWorkspace`：跑一次 op 后 interrupt，Resume 再跑。
 * 不走 60s 预算 race（等人点按钮会超过墙钟）。
 *
 * 场景：用户说「我的原文库」→ 根目录 list 出按钮 → 点「打开 hello.txt」。
 * Resume 时 LangGraph 会从头再进本函数；create 不能重做，靠 op-cache 挡。
 */
export const runVaultWorkspaceNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("VaultWrite", "进入", {
    via: "vaultWorkspace",
    slotId: state.activeSlotId,
  });

  // 用 Send 带来的 activeSlotId 对上 compositeSlots 里那条 vault 槽
  const slot = resolveActiveSlot(state);
  if (!slot) {
    // 人机协同进不来：没槽就交错误补丁，不再二次 resolve / 跑 op
    return {
      fanOutSlotPatches: [missingVaultWorkspaceSlotPatch(state)],
    };
  }

  // 槽上的结构化操作。第一次：「我的原文库」→ { operation: "list", targetPath: "" }
  // 点按钮后下一步不改槽，只改下面循环里的 params
  let params: VaultWorkspaceParams =
    parseVaultWorkspaceParams(
      (slot.params as Record<string, unknown> | undefined) ?? null
    ) ?? {
      operation: "list",
      targetPath: String(slot.searchQuery ?? "").trim() || "",
    };
  const language = state.decision?.language === "en" ? "en" : "zh";

  // 缓存按会话；discard 旧图时清掉
  const conversationId = state.context.conversationId;
  for (;;) {
    // Resume 重入：params 仍是槽上的 list 根 → 命中缓存，不再扫盘
    let result = takeCachedVaultWorkspaceOp(conversationId, params);
    if (!result) {
      // 第一次 / 新操作：真做 list、open、create、delete
      result = await runVaultWorkspaceOp({
        corpusUserId: state.context.corpusUserId,
        params,
        language,
      });
      // 记下「这组 params 做过」；create 重入时直接复用，避免再建一个 untitled
      rememberVaultWorkspaceOp(conversationId, params, result);
    }
    // 第一次：抛 GraphInterrupt，聊天出现列表+按钮，128 行暂时不到
    // 点「打开 hello.txt」后重入：interrupt 变成返回值 { kind: "vault_action", prompt }
    const resume: unknown = interrupt({
      kind: "vault_wait",
      answer: result.answer,
      blocks: result.blocks ?? [],
    });
    // prompt → 下一步 params（open hello.txt）；下一圈没命中缓存，真打开，再 interrupt
    params = paramsFromResume(resume, params);
  }
};
