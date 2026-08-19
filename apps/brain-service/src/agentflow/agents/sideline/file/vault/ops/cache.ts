/**
 * 按 conversationId 缓存最近一次 vault op 结果。
 * 节点 Resume 从入口重跑，写操作须命中缓存以免重复执行；discard 时清除。
 */
import { registerFileDiscardHook } from "@/agentflow/execution";
import type { VaultWorkspaceRunResult } from "./interface";

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

registerFileDiscardHook((conversationId) => {
  cache.delete(conversationId);
});
