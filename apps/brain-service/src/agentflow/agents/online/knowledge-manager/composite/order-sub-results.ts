/**
 * 按 Intake compositeSlots 顺序排列分槽结果（planSlotJoin 用）。
 */
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";
import type { CompositeSubRetrieval } from "./interface";

export const orderSubResultsBySlots = (
  slots: CompositeRetrievalSlot[],
  parts: CompositeSubRetrieval[]
): CompositeSubRetrieval[] => {
  const byId = new Map<string, CompositeSubRetrieval>();
  for (const s of parts) {
    byId.set(String(s.slot), s);
  }
  return slots.map((slot, i) => {
    const found = byId.get(String(slot.id));
    if (found) return found;
    return {
      slot: slot.id,
      facetKey: `empty:${i}`,
      label: slot.label,
      hits: [],
      coverage: "none" as const,
      notes: null,
      cacheHit: false,
      facetAnswerCacheHit: false,
    };
  });
};
