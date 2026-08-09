import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseEditOperation,
  previewCorpusMarkdown,
  proposeCorpusEdit,
  proposeCorpusEditLegacy,
  resolveCorpusMarkdownAbsPath,
} from "@/agentflow/agents/online/hitl-write";

const CORPUS_USER = "eval-hitl-unit";
const REL = "personal/_unit_abc.md";

const cleanup = async () => {
  const resolved = resolveCorpusMarkdownAbsPath(CORPUS_USER, REL);
  if (!resolved) return;
  try {
    await unlink(resolved.absPath);
  } catch {
    /* ignore */
  }
};

describe("hitl-write propose (retired + legacy)", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("parses open operation", () => {
    expect(parseEditOperation("open")).toBe("open");
    expect(parseEditOperation("OPEN")).toBe("open");
  });

  it("production proposeCorpusEdit always retires", async () => {
    const out = await proposeCorpusEdit({
      userId: "user_unit",
      corpusUserId: CORPUS_USER,
      threadId: "t-retired",
      targetPath: REL,
      operation: "update",
      afterContent: "# x\n",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("corpus_md_hitl_retired");
  });

  it("legacy: update with empty afterContent is rejected", async () => {
    const resolved = resolveCorpusMarkdownAbsPath(CORPUS_USER, REL);
    expect(resolved).not.toBeNull();
    await mkdir(path.dirname(resolved!.absPath), { recursive: true });
    await writeFile(resolved!.absPath, "# keep\n", "utf8");

    const out = await proposeCorpusEditLegacy({
      userId: "user_unit",
      corpusUserId: CORPUS_USER,
      threadId: "t-b",
      targetPath: REL,
      operation: "update",
      afterContent: "",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("empty_after_content");
    expect(await readFile(resolved!.absPath, "utf8")).toBe("# keep\n");
  });

  it("B: open preview reads content without writing", async () => {
    const resolved = resolveCorpusMarkdownAbsPath(CORPUS_USER, REL);
    expect(resolved).not.toBeNull();
    await mkdir(path.dirname(resolved!.absPath), { recursive: true });
    await writeFile(resolved!.absPath, "# preview body\n", "utf8");

    const preview = await previewCorpusMarkdown({
      corpusUserId: CORPUS_USER,
      targetPath: REL,
    });
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.content).toContain("preview body");
    }
    expect(await readFile(resolved!.absPath, "utf8")).toBe("# preview body\n");
  });

  it("legacy rejects open via propose", async () => {
    const out = await proposeCorpusEditLegacy({
      userId: "user_unit",
      corpusUserId: CORPUS_USER,
      threadId: "t-open",
      targetPath: REL,
      operation: "open",
      afterContent: "",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe("open_not_writable");
  });
});
