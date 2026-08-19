import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const updateMany = vi.fn();

vi.mock("../client", () => ({
  prisma: {
    fileJob: { findMany, updateMany, create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

describe("file-jobs supersede / expire", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("supersedes only workspace jobs when tasks filter is set", async () => {
    updateMany.mockResolvedValue({ count: 2 });
    const { supersedeFileJobs } = await import("./file-jobs");
    const n = await supersedeFileJobs("c1", { tasks: ["workspace"] });
    expect(n).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        conversationId: "c1",
        status: { in: ["pending", "running", "paused"] },
        task: { in: ["workspace"] },
      },
      data: { status: "superseded" },
    });
  });

  it("expires paused jobs older than ttl", async () => {
    findMany.mockResolvedValue([{ id: "j1" }, { id: "j2" }]);
    updateMany.mockResolvedValue({ count: 2 });
    const { expireStaleFileJobs } = await import("./file-jobs");
    const ids = await expireStaleFileJobs("c1", 30 * 60 * 1000);
    expect(ids).toEqual(["j1", "j2"]);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["j1", "j2"] } },
      data: { status: "cancelled" },
    });
  });
});
