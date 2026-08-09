/**
 * HITL corpus_edit golden probe（结构化字段，不经 Intake 口语猜 path）。
 * A 空 create · B 无正文预览 · C 带正文 update
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
  buildCorpusEditAppliedActions,
  buildCorpusEditOpenActions,
  buildCorpusEditPendingActions,
  matchCorpusEditUiPrompt,
  parseEditOperation,
  previewCorpusMarkdown,
  proposeCorpusEdit,
  resolveCorpusMarkdownAbsPath,
  resumeCorpusEdit,
  startCorpusEditGraph,
} from "@/agentflow/agents/online/hitl-write";

export type CorpusEditProbeCase =
  | {
      id: string;
      label: string;
      mode: "create_empty";
      relativePath: string;
    }
  | {
      id: string;
      label: string;
      mode: "open_preview";
      relativePath: string;
      seedContent: string;
    }
  | {
      id: string;
      label: string;
      mode: "update_body";
      relativePath: string;
      afterContent: string;
      seedContent?: string;
    };

export type CorpusEditProbeSpec = {
  id: string;
  label: string;
  cases: CorpusEditProbeCase[];
};

export type CorpusEditProbeResult = {
  id: string;
  tier: "pipeline";
  label: string;
  pass: boolean;
  reason: string;
  latencyMs: number;
};

const pathPlanCheck = (
  caseId: string,
  label: string,
  relativePath: string,
  operation: string,
  afterContent: string,
  started: number
): CorpusEditProbeResult => {
  const plan = legalizePathPlan({
    steps: [
      {
        id: "edit-1",
        kind: "corpus_edit",
        label: "评测语料步",
        searchQuery: relativePath,
        queryType: "default",
        topics: ["personal"],
        params: {
          targetPath: relativePath,
          operation,
          afterContent,
        },
      },
    ],
  });
  const slots = deriveCompositeSlotsFromPathPlan(plan);
  const pathPlanOk =
    stepsOfKind(plan, "corpus_edit").length === 1 &&
    slots[0]?.executor === "corpus_edit" &&
    parseEditOperation(slots[0]?.params?.operation) ===
      parseEditOperation(operation);
  return {
    id: `${caseId}-pathplan`,
    tier: "pipeline",
    label: `${label} · pathPlan`,
    pass: pathPlanOk,
    reason: pathPlanOk
      ? "ok"
      : "corpus_edit 未合法化为 SlotExecutor=corpus_edit",
    latencyMs: Date.now() - started,
  };
};

const uiPromptCheck = (
  caseId: string,
  label: string,
  started: number
): CorpusEditProbeResult[] => {
  const detail = matchCorpusEditUiPrompt(
    `${CORPUS_EDIT_ACTION.openDetailPrefix}demo_id`
  );
  const open = matchCorpusEditUiPrompt(
    `${CORPUS_EDIT_ACTION.openFilePrefix}personal/_x.md`
  );
  const dismiss = matchCorpusEditUiPrompt(
    `${CORPUS_EDIT_ACTION.dismissEditPrefix}personal/_x.md`
  );
  const createLabels = buildCorpusEditPendingActions("p", "create", "zh").actions
    .map((a) => a.label)
    .join("|");
  const appliedLabels = buildCorpusEditAppliedActions(
    "personal/_x.md",
    "create",
    "zh"
  ).actions
    .map((a) => a.label)
    .join("|");
  const openLabels = buildCorpusEditOpenActions("personal/_x.md", "zh")
    .actions.map((a) => a.label)
    .join("|");
  const stageOk =
    createLabels.includes("确定新建") &&
    createLabels.includes("放弃新建") &&
    appliedLabels.includes("编辑新建文件") &&
    appliedLabels.includes("暂不编辑") &&
    openLabels.includes("编辑此文件");
  return [
    {
      id: `${caseId}-ui-detail`,
      tier: "pipeline",
      label: `${label} · UI detail`,
      pass: detail?.type === "detail" && detail.proposalId === "demo_id",
      reason:
        detail?.type === "detail"
          ? "ok"
          : "matchCorpusEditUiPrompt 未识别 detail 前缀",
      latencyMs: Date.now() - started,
    },
    {
      id: `${caseId}-ui-open`,
      tier: "pipeline",
      label: `${label} · UI open/dismiss`,
      pass:
        open?.type === "open" &&
        open.targetPath === "personal/_x.md" &&
        dismiss?.type === "dismiss_edit",
      reason:
        open?.type === "open" && dismiss?.type === "dismiss_edit"
          ? "ok"
          : "open/dismiss exact-match 未识别",
      latencyMs: Date.now() - started,
    },
    {
      id: `${caseId}-ui-stage-labels`,
      tier: "pipeline",
      label: `${label} · 分阶段按钮文案`,
      pass: stageOk,
      reason: stageOk
        ? "ok"
        : `labels create=${createLabels} applied=${appliedLabels} open=${openLabels}`,
      latencyMs: Date.now() - started,
    },
  ];
};

/** 结构归一：update + 空 afterContent → open（禁止空覆盖） */
const updateEmptyCoercesToOpenCheck = (
  caseId: string,
  label: string,
  relativePath: string,
  started: number
): CorpusEditProbeResult => {
  const plan = legalizePathPlan({
    steps: [
      {
        id: "edit-coerce",
        kind: "corpus_edit",
        label: "评测空 update→open",
        searchQuery: relativePath,
        queryType: "default",
        topics: ["personal"],
        params: {
          targetPath: relativePath,
          operation: "update",
          afterContent: "",
        },
      },
    ],
  });
  const op = String(plan.steps[0]?.params?.operation ?? "");
  const ok = op === "open";
  return {
    id: `${caseId}-coerce-open`,
    tier: "pipeline",
    label: `${label} · update空→open`,
    pass: ok,
    reason: ok ? "ok" : `expected open, got ${op || "(missing)"}`,
    latencyMs: Date.now() - started,
  };
};

const requireActiveUser = async () =>
  prisma.user.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

const runCreateEmpty = async (
  c: Extract<CorpusEditProbeCase, { mode: "create_empty" }>,
  corpusUserId: string,
  started: number
): Promise<CorpusEditProbeResult[]> => {
  const results: CorpusEditProbeResult[] = [
    pathPlanCheck(c.id, c.label, c.relativePath, "create", "", started),
    ...uiPromptCheck(c.id, c.label, started),
  ];

  const user = await requireActiveUser();
  if (!user) {
    results.push({
      id: `${c.id}-apply`,
      tier: "pipeline",
      label: `${c.label} · interrupt/apply`,
      pass: false,
      reason: "DB 无 ACTIVE 用户，跳过写盘断言",
      latencyMs: Date.now() - started,
    });
    return results;
  }

  const resolved = resolveCorpusMarkdownAbsPath(corpusUserId, c.relativePath);
  if (!resolved) {
    results.push({
      id: `${c.id}-apply`,
      tier: "pipeline",
      label: `${c.label} · interrupt/apply`,
      pass: false,
      reason: "relativePath 未通过白名单",
      latencyMs: Date.now() - started,
    });
    return results;
  }

  await mkdir(path.dirname(resolved.absPath), { recursive: true });
  try {
    await unlink(resolved.absPath);
  } catch {
    /* not exists */
  }

  const threadId = `eval-corpus-edit-A:${Date.now()}`;
  try {
    const graphOut = await startCorpusEditGraph({
      userId: user.id,
      corpusUserId,
      threadId,
      targetPath: c.relativePath,
      operation: "create",
      afterContent: "",
    });
    const proposalId = (
      graphOut as { __interrupt__?: Array<{ value?: { proposalId?: string } }> }
    ).__interrupt__?.[0]?.value?.proposalId;
    if (!proposalId) {
      results.push({
        id: `${c.id}-apply`,
        tier: "pipeline",
        label: `${c.label} · interrupt/apply`,
        pass: false,
        reason: "空 create 未返回 __interrupt__.proposalId",
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
        id: `${c.id}-apply`,
        tier: "pipeline",
        label: `${c.label} · interrupt/apply`,
        pass: false,
        reason: `resume approve failed: ${"error" in applied ? applied.error : "not applied"}`,
        latencyMs: Date.now() - started,
      });
      return results;
    }

    const disk = await readFile(resolved.absPath, "utf8");
    const emptyOk = disk.trim().length === 0;
    results.push({
      id: `${c.id}-apply`,
      tier: "pipeline",
      label: `${c.label} · interrupt/apply`,
      pass: emptyOk,
      reason: emptyOk
        ? `ok empty file (via=${applied.via})`
        : `expected empty file, got: ${disk.slice(0, 80)}`,
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

const runOpenPreview = async (
  c: Extract<CorpusEditProbeCase, { mode: "open_preview" }>,
  corpusUserId: string,
  started: number
): Promise<CorpusEditProbeResult[]> => {
  const results: CorpusEditProbeResult[] = [
    pathPlanCheck(c.id, c.label, c.relativePath, "open", "", started),
    updateEmptyCoercesToOpenCheck(c.id, c.label, c.relativePath, started),
    ...uiPromptCheck(c.id, c.label, started),
  ];

  const user = await requireActiveUser();
  const resolved = resolveCorpusMarkdownAbsPath(corpusUserId, c.relativePath);
  if (!resolved) {
    results.push({
      id: `${c.id}-preview`,
      tier: "pipeline",
      label: `${c.label} · preview`,
      pass: false,
      reason: "relativePath 未通过白名单",
      latencyMs: Date.now() - started,
    });
    return results;
  }

  await mkdir(path.dirname(resolved.absPath), { recursive: true });
  await writeFile(resolved.absPath, c.seedContent, "utf8");

  try {
    const preview = await previewCorpusMarkdown({
      corpusUserId,
      targetPath: c.relativePath,
    });
    const previewOk =
      preview.ok &&
      preview.content.includes(c.seedContent.trim().slice(0, 8));

    // 无正文 update 不得进 propose 写空覆盖
    let proposeBlocked = false;
    if (user) {
      const blocked = await proposeCorpusEdit({
        userId: user.id,
        corpusUserId,
        threadId: `eval-corpus-edit-B-block:${Date.now()}`,
        targetPath: c.relativePath,
        operation: "update",
        afterContent: "",
      });
      proposeBlocked = !blocked.ok && blocked.error === "empty_after_content";
    } else {
      proposeBlocked = true; // 无用户时仍断言 preview
    }

    const diskBefore = await readFile(resolved.absPath, "utf8");
    const unchanged = diskBefore === c.seedContent;

    results.push({
      id: `${c.id}-preview`,
      tier: "pipeline",
      label: `${c.label} · preview + no empty overwrite`,
      pass: Boolean(previewOk && proposeBlocked && unchanged),
      reason:
        previewOk && proposeBlocked && unchanged
          ? "ok"
          : `previewOk=${previewOk} proposeBlocked=${proposeBlocked} unchanged=${unchanged}`,
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

const runUpdateBody = async (
  c: Extract<CorpusEditProbeCase, { mode: "update_body" }>,
  corpusUserId: string,
  started: number
): Promise<CorpusEditProbeResult[]> => {
  const results: CorpusEditProbeResult[] = [
    pathPlanCheck(
      c.id,
      c.label,
      c.relativePath,
      "update",
      c.afterContent,
      started
    ),
    ...uiPromptCheck(c.id, c.label, started),
  ];

  const user = await requireActiveUser();
  if (!user) {
    results.push({
      id: `${c.id}-apply`,
      tier: "pipeline",
      label: `${c.label} · interrupt/apply`,
      pass: false,
      reason: "DB 无 ACTIVE 用户，跳过写盘断言",
      latencyMs: Date.now() - started,
    });
    return results;
  }

  const resolved = resolveCorpusMarkdownAbsPath(corpusUserId, c.relativePath);
  if (!resolved) {
    results.push({
      id: `${c.id}-apply`,
      tier: "pipeline",
      label: `${c.label} · interrupt/apply`,
      pass: false,
      reason: "relativePath 未通过白名单",
      latencyMs: Date.now() - started,
    });
    return results;
  }

  await mkdir(path.dirname(resolved.absPath), { recursive: true });
  await writeFile(
    resolved.absPath,
    c.seedContent ?? "# seed\nbefore\n",
    "utf8"
  );

  const threadId = `eval-corpus-edit-C:${Date.now()}`;
  try {
    const graphOut = await startCorpusEditGraph({
      userId: user.id,
      corpusUserId,
      threadId,
      targetPath: c.relativePath,
      operation: "update",
      afterContent: c.afterContent,
    });
    const proposalId = (
      graphOut as { __interrupt__?: Array<{ value?: { proposalId?: string } }> }
    ).__interrupt__?.[0]?.value?.proposalId;
    if (!proposalId) {
      results.push({
        id: `${c.id}-apply`,
        tier: "pipeline",
        label: `${c.label} · interrupt/apply`,
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
        id: `${c.id}-apply`,
        tier: "pipeline",
        label: `${c.label} · interrupt/apply`,
        pass: false,
        reason: `resume approve failed: ${"error" in applied ? applied.error : "not applied"}`,
        latencyMs: Date.now() - started,
      });
      return results;
    }

    const disk = await readFile(resolved.absPath, "utf8");
    const marker = c.afterContent.trim().slice(0, 12);
    const contentOk = marker.length > 0 && disk.includes(marker);
    results.push({
      id: `${c.id}-apply`,
      tier: "pipeline",
      label: `${c.label} · interrupt/apply`,
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

export const runCorpusEditProbe = async (
  probe: CorpusEditProbeSpec,
  corpusUserId: string
): Promise<CorpusEditProbeResult[]> => {
  const started = Date.now();
  const results: CorpusEditProbeResult[] = [];

  for (const c of probe.cases) {
    if (c.mode === "create_empty") {
      results.push(...(await runCreateEmpty(c, corpusUserId, started)));
    } else if (c.mode === "open_preview") {
      results.push(...(await runOpenPreview(c, corpusUserId, started)));
    } else {
      results.push(...(await runUpdateBody(c, corpusUserId, started)));
    }
  }

  return results;
};
