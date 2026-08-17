/**
 * Resume 时 LangGraph 会从头重跑节点；list/open 可重入，create 不能再写一遍。
 * 按会话缓存上一次 op 结果，discard 时清掉。
 */
import { registerPipelineDiscardHook } from "@/agentflow/execution";
import type { VaultWorkspaceRunResult } from "./ops";

const cache = new Map<
  string,
  { sig: string; result: VaultWorkspaceRunResult }
>();

const paramsSig = (params: unknown): string => JSON.stringify(params);

export const takeCachedVaultWorkspaceOp = (
  conversationId: string,
  params: unknown
): VaultWorkspaceRunResult | null => {
  const hit = cache.get(conversationId);
  if (!hit) return null;
  return hit.sig === paramsSig(params) ? hit.result : null;
};

export const rememberVaultWorkspaceOp = (
  conversationId: string,
  params: unknown,
  result: VaultWorkspaceRunResult
): void => {
  cache.set(conversationId, { sig: paramsSig(params), result });
};

registerPipelineDiscardHook((conversationId) => {
  cache.delete(conversationId);
});
