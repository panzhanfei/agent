/**
 * 全局 B LLM JSON → Zod 合法化（结构兜底，非业务猜意图）。
 */
import { z } from "zod";
import type { GlobalRebatchRepair } from "./interface";

const actionSchema = z.enum([
  "rewrite_search_query",
  "use_web_search",
  "abandon",
]);

const repairSchema = z.object({
  targetId: z.string().trim().min(1),
  kind: z.enum(["slot", "dag_node"]).default("slot"),
  action: actionSchema,
  searchQuery: z.string().trim().nullable().optional(),
  webQuery: z.string().trim().nullable().optional(),
});

const planSchema = z.object({
  repairs: z.array(repairSchema).default([]),
});

export const parseGlobalRebatchPlan = (
  raw: unknown
): { repairs: GlobalRebatchRepair[] } => {
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) {
    return { repairs: [] };
  }
  const repairs: GlobalRebatchRepair[] = [];
  for (const r of parsed.data.repairs) {
    if (r.action === "rewrite_search_query") {
      const q = (r.searchQuery ?? r.webQuery ?? "").trim();
      if (!q) continue;
      repairs.push({
        targetId: r.targetId,
        kind: r.kind,
        action: r.action,
        searchQuery: q,
        webQuery: r.webQuery ?? null,
      });
      continue;
    }
    if (r.action === "use_web_search") {
      const q = (r.webQuery ?? r.searchQuery ?? "").trim();
      if (!q) continue;
      repairs.push({
        targetId: r.targetId,
        kind: r.kind,
        action: r.action,
        searchQuery: q,
        webQuery: q,
      });
      continue;
    }
    repairs.push({
      targetId: r.targetId,
      kind: r.kind,
      action: "abandon",
      searchQuery: null,
      webQuery: null,
    });
  }
  return { repairs };
};
