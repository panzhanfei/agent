import { z } from "zod";
import { normalizeFactKey } from "@/agentflow/agents/online/user-fact";
import type {
  ExtractedUserMemoryFact,
  UserMemoryExtractLlmResult,
} from "./interface";

const factSchema = z.object({
  factKey: z.coerce.string().optional(),
  label: z.coerce.string().optional(),
  value: z.coerce.string().optional(),
  confidence: z.coerce.number().optional(),
});

const resultSchema = z.object({
  facts: z.array(factSchema).catch([]),
});

/** Zod 合法化：非法/缺字段丢弃；不做口语意图猜测。 */
export const legalizeExtractedUserMemoryFacts = (
  raw: unknown,
  minConfidence: number
): ExtractedUserMemoryFact[] => {
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) return [];

  const out: ExtractedUserMemoryFact[] = [];
  const seen = new Set<string>();

  for (const row of parsed.data.facts) {
    const label = (row.label ?? "").trim();
    const value = (row.value ?? "").trim().replace(/[。！？!?.]+$/u, "");
    const factKey = normalizeFactKey(row.factKey ?? "");
    const confidence = Number.isFinite(row.confidence)
      ? Math.min(1, Math.max(0, row.confidence as number))
      : 0;

    if (!factKey || !label || !value) continue;
    if (value.length > 200) continue;
    if (confidence < minConfidence) continue;

    const dedupe = `${factKey}:${value}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    out.push({ factKey, label, value, confidence });
  }

  return out;
};

export const parseUserMemoryExtractResult = (
  raw: unknown,
  minConfidence: number
): UserMemoryExtractLlmResult => ({
  facts: legalizeExtractedUserMemoryFacts(raw, minConfidence),
});
