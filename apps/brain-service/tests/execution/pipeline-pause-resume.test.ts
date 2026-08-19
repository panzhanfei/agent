import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  discardPipelineTask,
  extractPipelinePauseValue,
  isPipelinePauseValue,
  isResumablePipelinePause,
  pipelineThreadId,
  resetPipelineCheckpointForTests,
  useSqliteCheckpointerForTests,
} from "@/agentflow/execution";
import { resetCompiledPipelineGraph } from "@/agentflow/pipeline/graph/compile";
import {
  buildVaultWorkspaceUiDecision,
  matchVaultWorkspaceUiAction,
  runVaultWorkspaceOp,
  VAULT_WORKSPACE_UI_ENTRY,
} from "@/agentflow/agents/sideline/file";
import { disableActionsInMetadata } from "@fambrain/db";
import { isVaultWorkspaceActionPrompt } from "../../../web/src/lib/chat/action-lifecycle";

afterEach(() => {
  resetPipelineCheckpointForTests();
  resetCompiledPipelineGraph();
});

describe("pipeline checkpoint thread generation", () => {
  it("bumps thread id on discard so old pause cannot resume", () => {
    const conv = "conv-a";
    const first = pipelineThreadId(conv);
    expect(first).toBe("fambrain:conv-a:0");
    const next = discardPipelineTask(conv);
    expect(next).toBe("fambrain:conv-a:1");
    expect(pipelineThreadId(conv)).not.toBe(first);
  });

  it("sqlite checkpointer persists generation across reopen", () => {
    const dbPath = path.join(
      os.tmpdir(),
      `fambrain-ckpt-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    );
    useSqliteCheckpointerForTests(dbPath);
    expect(pipelineThreadId("conv-sql")).toBe("fambrain:conv-sql:0");
    discardPipelineTask("conv-sql");
    expect(pipelineThreadId("conv-sql")).toBe("fambrain:conv-sql:1");
    useSqliteCheckpointerForTests(dbPath);
    expect(pipelineThreadId("conv-sql")).toBe("fambrain:conv-sql:1");
  });

  it("extracts pause payload from GraphInterrupt-shaped values", () => {
    const pause = {
      kind: "vault_wait" as const,
      answer: "原文库",
      blocks: [],
    };
    expect(isPipelinePauseValue(pause)).toBe(true);
    expect(
      extractPipelinePauseValue([{ value: pause }])
    ).toEqual(pause);
    expect(extractPipelinePauseValue({ interrupts: [{ value: pause }] })).toEqual(
      pause
    );
    expect(extractPipelinePauseValue({ kind: "other" })).toBeNull();
  });

  it("treats gen_pause as stop, vault_wait as resumable", () => {
    const gen = {
      kind: "gen_pause" as const,
      answer: "半截稿",
      blocks: [],
    };
    const vault = {
      kind: "vault_wait" as const,
      answer: "原文库",
      blocks: [],
    };
    expect(isPipelinePauseValue(gen)).toBe(true);
    expect(isResumablePipelinePause(gen)).toBe(false);
    expect(isResumablePipelinePause(vault)).toBe(true);
  });
});

describe("vault UI routes into pathPlan without Intake CRUD", () => {
  it("entry prompt builds vault_workspace decision only", () => {
    const action = matchVaultWorkspaceUiAction(VAULT_WORKSPACE_UI_ENTRY);
    expect(action).toEqual({ type: "list", folderRel: "" });
    if (!action || action.type === "done") {
      throw new Error("expected list action");
    }
    const decision = buildVaultWorkspaceUiDecision(action);
    expect(decision.routeMode).toBe("fileHandoff");
    expect(decision.pathPlan.steps[0]?.kind).toBe("vault_workspace");
    expect(decision.compositeSlots[0]?.executor).toBe("vault_workspace");
    expect(
      (decision as { answer?: unknown }).answer
    ).toBeUndefined();
  });
});

describe("disableActionsInMetadata", () => {
  it("marks all actions disabled and clears taskPaused", () => {
    const patched = disableActionsInMetadata({
      taskPaused: true,
      pauseKind: "vault_wait",
      blocks: [
        {
          type: "actions",
          actions: [
            { id: "a", label: "打开", prompt: "p", disabled: false },
            { id: "b", label: "删", prompt: "q" },
          ],
        },
      ],
    });
    expect(patched?.changed).toBe(true);
    expect(patched?.next.taskPaused).toBe(false);
    const actions = (
      patched?.next.blocks as Array<{
        actions: Array<{ disabled?: boolean }>;
      }>
    )[0]?.actions;
    expect(actions?.every((a) => a.disabled)).toBe(true);
  });
});

describe("isVaultWorkspaceActionPrompt", () => {
  it("matches entry and internal prefixes", () => {
    expect(isVaultWorkspaceActionPrompt("我的原文库")).toBe(true);
    expect(
      isVaultWorkspaceActionPrompt("__FAMBRAIN_VAULT_WS_LIST__:")
    ).toBe(true);
    expect(isVaultWorkspaceActionPrompt("列出全部项目名称")).toBe(false);
  });
});

describe("vault create does not await embed", () => {
  it("returns 已提交语料化 without blocking on index", async () => {
    const docRoot = await mkdtemp(path.join(os.tmpdir(), "fambrain-vault-pause-"));
    const prev = process.env.FAMBRAIN_DOC_ROOT_OVERRIDE;
    process.env.FAMBRAIN_DOC_ROOT_OVERRIDE = docRoot;
    try {
      const result = await runVaultWorkspaceOp({
        corpusUserId: "pause-test-user",
        params: {
          operation: "create_file",
          targetPath: "",
          name: "hello.txt",
          afterContent: "hi",
        },
        language: "zh",
      });
      expect(result.ok).toBe(true);
      expect(result.syncNote).toMatch(/已提交语料化/);
      expect(result.answer).toMatch(/已提交语料化/);
    } finally {
      if (prev === undefined) delete process.env.FAMBRAIN_DOC_ROOT_OVERRIDE;
      else process.env.FAMBRAIN_DOC_ROOT_OVERRIDE = prev;
      await rm(docRoot, { recursive: true, force: true });
    }
  });
});
