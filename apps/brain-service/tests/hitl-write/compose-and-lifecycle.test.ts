import { describe, expect, it } from "vitest";
import {
  CORPUS_EDIT_ACTION,
  CHAT_ACTION_PENDING_TTL_MS,
  CORPUS_EDIT_PENDING_TTL_MS,
  buildCorpusEditAppliedActions,
  buildCorpusEditOpenActions,
  buildCorpusEditPendingActions,
  buildCorpusEditReviewActions,
  corpusEditStaleGroupKey,
  matchCorpusEditUiPrompt,
} from "@/agentflow/agents/online/hitl-write";

const actionLabels = (block: { type: string } & Record<string, unknown>) => {
  if (block.type !== "actions") throw new Error("expected actions block");
  const actions = block.actions as Array<{
    label: string;
    clientHandler?: string;
  }>;
  return actions;
};

describe("hitl-write stage labels", () => {
  it("pending create uses 确定新建 / 放弃新建", () => {
    const block = buildCorpusEditPendingActions("p1", "create", "zh");
    const labels = actionLabels(block).map((a) => a.label);
    expect(labels).toContain("确定新建");
    expect(labels).toContain("放弃新建");
    expect(labels).toContain("查看变更详情");
  });

  it("pending update uses 确定更新 / 放弃本次修改", () => {
    const block = buildCorpusEditReviewActions("p2", "update", "zh");
    expect(actionLabels(block).map((a) => a.label)).toEqual([
      "确定更新",
      "放弃本次修改",
    ]);
  });

  it("applied create offers 编辑新建文件 / 暂不编辑 with open_editor", () => {
    const block = buildCorpusEditAppliedActions(
      "personal/_x.md",
      "create",
      "zh"
    );
    const actions = actionLabels(block);
    expect(actions.map((a) => a.label)).toEqual([
      "编辑新建文件",
      "暂不编辑",
    ]);
    expect(actions[0]?.clientHandler).toBe("open_editor");
  });

  it("open preview offers 编辑此文件 with open_editor", () => {
    const block = buildCorpusEditOpenActions("personal/亲友关系.md", "zh");
    const actions = actionLabels(block);
    expect(actions).toHaveLength(1);
    expect(actions[0]?.label).toBe("编辑此文件");
    expect(actions[0]?.clientHandler).toBe("open_editor");
  });
});

describe("hitl-write dismiss + stale key", () => {
  it("matches dismiss_edit prompt", () => {
    const path = "personal/_x.md";
    expect(
      matchCorpusEditUiPrompt(`${CORPUS_EDIT_ACTION.dismissEditPrefix}${path}`)
    ).toEqual({ type: "dismiss_edit", targetPath: path });
  });

  it("groups approve/reject under same proposal key", () => {
    const id = "abc";
    expect(
      corpusEditStaleGroupKey(`${CORPUS_EDIT_ACTION.approvePrefix}${id}`)
    ).toBe(`proposal:${id}`);
    expect(
      corpusEditStaleGroupKey(`${CORPUS_EDIT_ACTION.rejectPrefix}${id}`)
    ).toBe(`proposal:${id}`);
  });

  it("TTL constant is 30 minutes (shared chat-action lifecycle)", () => {
    expect(CHAT_ACTION_PENDING_TTL_MS).toBe(30 * 60 * 1000);
    expect(CORPUS_EDIT_PENDING_TTL_MS).toBe(CHAT_ACTION_PENDING_TTL_MS);
  });
});
