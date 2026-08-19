import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const update = vi.fn();

vi.mock("../client", () => ({
  prisma: {
    message: { findMany, update },
  },
}));

vi.mock("../generated/prisma/client", () => ({
  ChatRole: { user: "user", assistant: "assistant" },
}));

describe("disableConversationActionBlocks keepFileJobIds", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("keeps paused save_offer buttons when keepFileJobIds matches", async () => {
    findMany.mockResolvedValue([
      {
        id: "m-save",
        metadata: {
          taskPaused: true,
          fileJobId: "job-save",
          blocks: [
            {
              type: "actions",
              actions: [{ id: "a", label: "确定入库", prompt: "p", disabled: false }],
            },
          ],
        },
      },
      {
        id: "m-ws",
        metadata: {
          taskPaused: true,
          fileJobId: "job-ws",
          blocks: [
            {
              type: "actions",
              actions: [{ id: "b", label: "打开", prompt: "q", disabled: false }],
            },
          ],
        },
      },
    ]);
    update.mockResolvedValue({});
    const { disableConversationActionBlocks } = await import("./conversations");
    const n = await disableConversationActionBlocks("c1", {
      keepFileJobIds: ["job-save"],
    });
    expect(n).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0]?.where).toEqual({ id: "m-ws" });
  });
});
