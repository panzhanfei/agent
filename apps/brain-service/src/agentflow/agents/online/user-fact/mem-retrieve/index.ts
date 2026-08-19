/**
 * memRetrieve：复合路径 Mem0 结构化召回（kind=mem / executor=mem_recall）。
 * 不查 corpus、不做 FC；结果写入 recalledFact → planSlotJoin。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { searchUserFactMemories } from "@fambrain/brain-memory";
import type { CompositeSubRetrieval } from "@/agentflow/agents/online/knowledge-manager";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import { resolveActiveSlot } from "@/agentflow/agents/online/plan-fanout/active-slot";
import type { PlanSlotWorkerPatch } from "@/agentflow/agents/online/plan-fanout/interface";
import { emitBudgetedSlotPatch } from "@/agentflow/agents/online/plan-fanout/slot-budget";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import {
  buildRecallAnswer,
  buildRecallMissingAnswer,
  findUserFactValueInMemoryBlock,
  findUserFactValueInTexts,
  normalizeFactKey,
} from "../user-fact";

const emptySub = (
  slotId: string,
  label: string,
  notes: string | null
): CompositeSubRetrieval => ({
  slot: slotId,
  label,
  hits: [],
  coverage: "none",
  notes,
  cacheHit: false,
  facetAnswerCacheHit: false,
  recalledFact: null,
  dataSource: "mem0",
});

const memStepResult = (
  slotId: string,
  label: string,
  notes: string | null,
  value: string | null
): StepResult => ({
  stepId: slotId,
  pathKind: "mem",
  label,
  hits: [],
  coverage: value ? "sufficient" : "none",
  notes,
  confidenceTier: value ? "high" : "low",
  enumerationMeta: null,
  cacheHit: false,
});

const resolveMemValue = async (
  state: PipelineGraphState,
  factKey: string,
  label: string
): Promise<string | null> => {
  const fromBlock = findUserFactValueInMemoryBlock(
    state.memoryBlock,
    factKey,
    label
  );
  if (fromBlock) return fromBlock;

  if (state.userMemories.length > 0) {
    const fromLoaded = findUserFactValueInTexts(
      state.userMemories,
      factKey,
      label
    );
    if (fromLoaded) return fromLoaded;
  }

  const actorUserId = state.context.actorUserId;
  if (actorUserId) {
    const searched = await searchUserFactMemories(
      actorUserId,
      factKey,
      label,
      state.userQuestion
    );
    return findUserFactValueInTexts(searched, factKey, label);
  }
  return null;
};

export const runMemSlotWorker = async (
  state: PipelineGraphState
): Promise<PlanSlotWorkerPatch> => {
  const slot = resolveActiveSlot(state);
  const slotId = state.activeSlotId ?? "unknown";
  if (!slot) {
    return {
      slotId,
      executor: "mem",
      sub: emptySub(slotId, "unknown", "缺少 activeSlotId"),
      stepResult: memStepResult(slotId, "unknown", "缺少 activeSlotId", null),
      error: "缺少 activeSlotId",
    };
  }

  const factKey = normalizeFactKey(slot.userFactKey ?? "");
  const label = slot.userFactLabel?.trim() || slot.label || factKey || "user_fact";
  const language = state.decision?.language ?? "zh";

  try {
    let resolvedKey = factKey;
    let resolvedLabel = label;
    let value: string | null = null;

    if (resolvedKey) {
      value = await resolveMemValue(state, resolvedKey, resolvedLabel);
    }

    if (!resolvedKey) {
      const notes =
        language === "en"
          ? "Missing userFactKey for mem slot."
          : "记忆召回步缺少 userFactKey。";
      return {
        slotId: String(slot.id),
        executor: "mem",
        sub: {
          ...emptySub(String(slot.id), slot.label, notes),
          recalledFact: { factKey: "", label, value: null },
        },
        stepResult: memStepResult(String(slot.id), slot.label, notes, null),
        error: null,
      };
    }

    const notes = value
      ? buildRecallAnswer(resolvedLabel, value, language)
      : buildRecallMissingAnswer(resolvedLabel, language);
    const sub: CompositeSubRetrieval = {
      slot: slot.id,
      facetKey: `mem:${resolvedKey || "unknown"}`,
      label: slot.label,
      hits: [],
      coverage: value ? "sufficient" : "none",
      notes,
      confidenceTier: value ? "high" : "low",
      cacheHit: false,
      facetAnswerCacheHit: false,
      recalledFact: {
        factKey: resolvedKey || "user_fact",
        label: resolvedLabel,
        value,
      },
      dataSource: "mem0",
    };
    return {
      slotId: String(slot.id),
      executor: "mem",
      sub,
      stepResult: memStepResult(String(slot.id), slot.label, notes, value),
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "mem 召回失败";
    const sub = emptySub(String(slot.id), slot.label, msg);
    return {
      slotId: String(slot.id),
      executor: "mem",
      sub,
      stepResult: memStepResult(String(slot.id), slot.label, msg, null),
      error: msg,
    };
  }
};

/** LangGraph memRetrieve 节点 */
export const runMemRetrieveNode = async (
  state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
  logAgentOut("UserFact", "进入", {
    via: "memRetrieve",
    slotId: state.activeSlotId,
  });

  const out = await emitBudgetedSlotPatch(state, "mem", () =>
    runMemSlotWorker(state)
  );
  const patch = out.fanOutSlotPatches?.[0];

  logAgentOut("UserFact", "出去", {
    via: "memRetrieve",
    slotId: patch?.slotId ?? state.activeSlotId,
    hasValue: Boolean(patch?.sub.recalledFact?.value),
    factKey: patch?.sub.recalledFact?.factKey ?? null,
    slotStatus: patch?.slotRuntime?.status ?? null,
  });

  return out;
};
