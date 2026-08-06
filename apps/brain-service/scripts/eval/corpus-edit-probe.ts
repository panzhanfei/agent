/**
 * HITL corpus_edit golden probe（结构化字段，不经 Intake 口语猜 path）。
 */
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@fambrain/db";
import {
  deriveCompositeSlotsFromPathPlan,
  legalizePathPlan,
  stepsOfKind,
} from "@/agentflow/agents/online/intake-coordinator";
import {
  CORPUS_EDIT_ACTION,
  matchCorpusEditUiPrompt,
  resolveCorpusMarkdownAbsPath,
  resumeCorpusEdit,
  startCorpusEditGraph,
} from "@/agentflow/agents/online/hitl-write";

export type CorpusEditProbeSpec = {
  id: string;
  label: string;
  relativePath: string;
  afterContent: string;
};

export type CorpusEditProbeResult = {
  id: string;
  tier: "pipeline";
  label: string;
  pass: boolean;
  reason: string;
  latencyMs: number;
};

export const runCorpusEditProbe = async (
  probe: CorpusEditProbeSpec,
  corpusUserId: string
): Promise<CorpusEditProbeResult[]> => {
  const started = Date.now();
  const results: CorpusEditProbeResult[] = [];

  const plan = legalizePathPlan({
    steps: [
      {
        id: "edit-1",
        kind: "corpus_edit",
        label: "修订评测文件",
        searchQuery: probe.relativePath,
        queryType: "default",
        topics: ["personal"],
        params: {
          targetPath: probe.relativePath,
          operation: "update",
          afterContent: probe.afterContent,
        },
      },
    ],
  });
  const slots = deriveCompositeSlotsFromPathPlan(plan);
  const pathPlanOk =
    stepsOfKind(plan, "corpus_edit").length === 1 &&
    slots[0]?.executor === "corpus_edit";
  results.push({
    id: `${probe.id}-pathplan`,
    tier: "pipeline",
    label: `${probe.label} · pathPlan`,
    pass: pathPlanOk,
    reason: pathPlanOk
      ? "ok"
      : "corpus_edit 未合法化为 SlotExecutor=corpus_edit",
    latencyMs: Date.now() - started,
  });

  const promptOk = matchCorpusEditUiPrompt(
    `${CORPUS_EDIT_ACTION.openDetailPrefix}demo_id`
  );
  results.push({
    id: `${probe.id}-ui-prompt`,
    tier: "pipeline",
    label: `${probe.label} · UI exact-match`,
    pass: promptOk?.type === "detail" && promptOk.proposalId === "demo_id",
    reason:
      promptOk?.type === "detail"
        ? "ok"
        : "matchCorpusEditUiPrompt 未识别 detail 前缀",
    latencyMs: Date.now() - started,
  });

  const user = await prisma.user.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!user) {
    results.push({
      id: `${probe.id}-apply`,
      tier: "pipeline",
      label: `${probe.label} · interrupt/apply`,
      pass: false,
      reason: "DB 无 ACTIVE 用户，跳过写盘断言",
      latencyMs: Date.now() - started,
    });
    return results;
  }

  const resolved = resolveCorpusMarkdownAbsPath(
    corpusUserId,
    probe.relativePath
  );
  if (!resolved) {
    results.push({
      id: `${probe.id}-apply`,
      tier: "pipeline",
      label: `${probe.label} · interrupt/apply`,
      pass: false,
      reason: "relativePath 未通过白名单",
      latencyMs: Date.now() - started,
    });
    return results;
  }

  await mkdir(path.dirname(resolved.absPath), { recursive: true });
  await writeFile(resolved.absPath, "# seed\nbefore\n", "utf8");

  const threadId = `eval-corpus-edit:${Date.now()}`;
  try {
    const graphOut = await startCorpusEditGraph({
      userId: user.id,
      corpusUserId,
      threadId,
      targetPath: probe.relativePath,
      operation: "update",
      afterContent: probe.afterContent,
    });
    const interrupt = (
      graphOut as { __interrupt__?: Array<{ value?: { proposalId?: string } }> }
    ).__interrupt__?.[0]?.value;
    const proposalId = interrupt?.proposalId;
    if (!proposalId) {
      results.push({
        id: `${probe.id}-apply`,
        tier: "pipeline",
        label: `${probe.label} · interrupt/apply`,
        pass: false,
        reason: "startCorpusEditGraph 未返回 __interrupt__.proposalId",
        latencyMs: Date.now() - started,
      });
      return results;
    }

    const applied = await resumeCorpusEdit({
      userId: user.id,
      proposalId,
      action: "approve",
    });
    if (!applied.ok || !applied.applied) {
      results.push({
        id: `${probe.id}-apply`,
        tier: "pipeline",
        label: `${probe.label} · interrupt/apply`,
        pass: false,
        reason: `resume approve failed: ${"error" in applied ? applied.error : "not applied"}`,
        latencyMs: Date.now() - started,
      });
      return results;
    }

    const disk = await readFile(resolved.absPath, "utf8");
    const marker = probe.afterContent.trim().slice(0, 12);
    const contentOk = marker.length > 0 && disk.includes(marker);
    results.push({
      id: `${probe.id}-apply`,
      tier: "pipeline",
      label: `${probe.label} · interrupt/apply`,
      pass: contentOk,
      reason: contentOk
        ? `ok (via=${applied.via})`
        : `disk content mismatch: ${disk.slice(0, 80)}`,
      latencyMs: Date.now() - started,
    });
  } finally {
    try {
      await unlink(resolved.absPath);
    } catch {
      /* ignore */
    }
  }

  return results;
};
