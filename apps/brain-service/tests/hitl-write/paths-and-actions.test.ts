import { describe, expect, it } from "vitest";
import {
  CORPUS_EDIT_ACTION,
  matchCorpusEditUiPrompt,
  normalizeRepoPath,
  resolveCorpusMarkdownAbsPath,
} from "@/agentflow/agents/online/hitl-write";

describe("hitl-write paths", () => {
  it("normalizes repo paths", () => {
    expect(normalizeRepoPath("./personal/a.md")).toBe("personal/a.md");
    expect(normalizeRepoPath("personal\\\\a.md")).toBe("personal/a.md");
  });

  it("allows corpus category .md paths and rejects traversal", () => {
    const ok = resolveCorpusMarkdownAbsPath("u1", "personal/profile.md");
    expect(ok?.repoPath).toBe("users/u1/corpus/personal/profile.md");
    expect(resolveCorpusMarkdownAbsPath("u1", "../secret.md")).toBeNull();
    expect(resolveCorpusMarkdownAbsPath("u1", "vault/x.md")).toBeNull();
    expect(resolveCorpusMarkdownAbsPath("u1", "personal/x.txt")).toBeNull();
  });
});

describe("hitl-write UI exact-match prompts", () => {
  it("matches detail / approve / reject prefixes only", () => {
    const id = "prop_1";
    expect(
      matchCorpusEditUiPrompt(`${CORPUS_EDIT_ACTION.openDetailPrefix}${id}`)
    ).toEqual({ type: "detail", proposalId: id });
    expect(
      matchCorpusEditUiPrompt(`${CORPUS_EDIT_ACTION.approvePrefix}${id}`)
    ).toEqual({ type: "approve", proposalId: id });
    expect(
      matchCorpusEditUiPrompt(`${CORPUS_EDIT_ACTION.rejectPrefix}${id}`)
    ).toEqual({ type: "reject", proposalId: id });
    expect(matchCorpusEditUiPrompt("请更新我的简历")).toBeNull();
    expect(matchCorpusEditUiPrompt("确认写入")).toBeNull();
  });
});
