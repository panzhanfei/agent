import type { AssistantMessageBlock, DbChatTurn } from "@fambrain/brain-types";
import { ChatRole, type Prisma } from "../generated/prisma/client";
import { prisma } from "../client";
export type MessageRow = {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  metadata?: unknown;
};
export const findOwnedConversation = async (
  conversationId: string,
  userId: string
) => {
  return prisma.conversation
    .findUnique({
      where: { id: conversationId },
      select: { id: true, userId: true, title: true },
    })
    .then((c) => (c && c.userId === userId ? c : null));
};
export const listConversationMessages = async (
  conversationId: string
): Promise<MessageRow[]> => {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
      metadata: true,
    },
  });
};
export const toModelHistory = (
  rows: {
    role: string;
    content: string;
    metadata?: unknown;
  }[]
): DbChatTurn[] => {
  return rows.map((r) => {
    const meta =
      r.metadata && typeof r.metadata === "object"
        ? (r.metadata as { blocks?: AssistantMessageBlock[] })
        : undefined;
    const blocks =
      meta?.blocks?.length && r.role === "assistant"
        ? meta.blocks
        : undefined;
    return {
      role: r.role as DbChatTurn["role"],
      content: r.content,
      ...(blocks ? { blocks } : {}),
    };
  });
};
export const appendUserMessage = async (
  conversationId: string,
  content: string
) => {
  return prisma.message.create({
    data: {
      conversationId,
      role: ChatRole.user,
      content,
    },
    select: { id: true, role: true, content: true },
  });
};
export const appendAssistantMessage = async (
  conversationId: string,
  content: string,
  metadata?: Prisma.InputJsonValue
) => {
  return prisma.message.create({
    data: {
      conversationId,
      role: ChatRole.assistant,
      content,
      metadata: metadata ?? undefined,
    },
    select: { id: true, role: true, content: true },
  });
};
const CONVERSATION_TITLE_MAX_LEN = 20;

/** 首条用户消息 → 侧边栏/顶栏标题：取第一个问句，再截断 */
export const deriveConversationTitle = (firstUserContent: string): string => {
  const trimmed = firstUserContent.trim();
  if (!trimmed) return "新对话";
  const firstPart = trimmed.split(/[？?\n;；]/)[0]?.trim() || trimmed;
  if (firstPart.length <= CONVERSATION_TITLE_MAX_LEN) return firstPart;
  return `${firstPart.slice(0, CONVERSATION_TITLE_MAX_LEN)}…`;
};

export const maybeUpdateConversationTitle = async (
  conversationId: string,
  currentTitle: string,
  firstUserContent: string
) => {
  if (currentTitle !== "新对话") return;
  const messageCount = await prisma.message.count({
    where: { conversationId },
  });
  if (messageCount !== 1) return;
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { title: deriveConversationTitle(firstUserContent) },
  });
};

export const deleteOwnedConversation = async (
  conversationId: string,
  userId: string
): Promise<boolean> => {
  const owned = await findOwnedConversation(conversationId, userId);
  if (!owned) return false;
  await prisma.conversation.delete({ where: { id: conversationId } });
  return true;
};

export type EditUserMessageTruncateResult =
  | {
      ok: true;
      message: { id: string; role: string; content: string };
      deletedCount: number;
    }
  | { ok: false; error: "not_found" | "not_user_message" | "forbidden" };

/**
 * 原地改用户消息 + 删除该条之后的所有消息（ChatGPT 线性截断）。
 * conversation 须属于 userId。
 */
export const editUserMessageAndTruncateAfter = async (input: {
  conversationId: string;
  userId: string;
  messageId: string;
  content: string;
}): Promise<EditUserMessageTruncateResult> => {
  const content = input.content.trim();
  if (!content) {
    return { ok: false, error: "not_found" };
  }

  const owned = await findOwnedConversation(input.conversationId, input.userId);
  if (!owned) return { ok: false, error: "forbidden" };

  return prisma.$transaction(async (tx) => {
    const target = await tx.message.findFirst({
      where: {
        id: input.messageId,
        conversationId: input.conversationId,
      },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });
    if (!target) return { ok: false, error: "not_found" as const };
    if (target.role !== ChatRole.user) {
      return { ok: false, error: "not_user_message" as const };
    }

    const updated = await tx.message.update({
      where: { id: target.id },
      data: { content },
      select: { id: true, role: true, content: true },
    });

    // 删除 createdAt 更晚的；同刻用 id 字典序更大的（cuid 近似按时间）
    const deleted = await tx.message.deleteMany({
      where: {
        conversationId: input.conversationId,
        OR: [
          { createdAt: { gt: target.createdAt } },
          {
            createdAt: target.createdAt,
            id: { gt: target.id },
          },
        ],
      },
    });

    return {
      ok: true as const,
      message: updated,
      deletedCount: deleted.count,
    };
  });
};
