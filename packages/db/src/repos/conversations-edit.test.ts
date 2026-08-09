import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const deleteMany = vi.fn();
const transaction = vi.fn();

vi.mock("../client", () => ({
  prisma: {
    conversation: { findUnique },
    message: { findFirst, update, deleteMany },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      transaction(fn),
  },
}));

vi.mock("../generated/prisma/client", () => ({
  ChatRole: { user: "user", assistant: "assistant" },
}));

describe("editUserMessageAndTruncateAfter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        message: { findFirst, update, deleteMany },
      };
      return fn(tx);
    });
  });

  it("updates user message and deletes only later messages", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      userId: "u1",
      title: "t",
    });
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    findFirst.mockResolvedValue({
      id: "m-user",
      role: "user",
      content: "old",
      createdAt,
    });
    update.mockResolvedValue({
      id: "m-user",
      role: "user",
      content: "new question",
    });
    deleteMany.mockResolvedValue({ count: 2 });

    const { editUserMessageAndTruncateAfter } = await import("./conversations");
    const result = await editUserMessageAndTruncateAfter({
      conversationId: "c1",
      userId: "u1",
      messageId: "m-user",
      content: "new question",
    });

    expect(result).toEqual({
      ok: true,
      message: {
        id: "m-user",
        role: "user",
        content: "new question",
      },
      deletedCount: 2,
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "m-user" },
      data: { content: "new question" },
      select: { id: true, role: true, content: true },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        conversationId: "c1",
        OR: [
          { createdAt: { gt: createdAt } },
          { createdAt, id: { gt: "m-user" } },
        ],
      },
    });
  });

  it("rejects assistant messages", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      userId: "u1",
      title: "t",
    });
    findFirst.mockResolvedValue({
      id: "m-a",
      role: "assistant",
      content: "hi",
      createdAt: new Date(),
    });

    const { editUserMessageAndTruncateAfter } = await import("./conversations");
    const result = await editUserMessageAndTruncateAfter({
      conversationId: "c1",
      userId: "u1",
      messageId: "m-a",
      content: "x",
    });
    expect(result).toEqual({ ok: false, error: "not_user_message" });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects when conversation not owned", async () => {
    findUnique.mockResolvedValue(null);
    const { editUserMessageAndTruncateAfter } = await import("./conversations");
    const result = await editUserMessageAndTruncateAfter({
      conversationId: "c1",
      userId: "u1",
      messageId: "m1",
      content: "x",
    });
    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("editRegenerateMessageBodySchema", () => {
  it("accepts content and optional turnId", async () => {
    const { editRegenerateMessageBodySchema } = await import("../schemas/chat");
    expect(
      editRegenerateMessageBodySchema.safeParse({ content: "改问" }).success
    ).toBe(true);
    expect(
      editRegenerateMessageBodySchema.safeParse({
        content: "改问",
        turnId: "00000000-0000-4000-8000-000000000001",
      }).success
    ).toBe(true);
    expect(editRegenerateMessageBodySchema.safeParse({}).success).toBe(false);
  });
});
