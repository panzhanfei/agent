import { ChatRole } from "../generated/prisma/client";
import { z } from "zod";
export const conversationIdSchema = z.cuid();
export const createConversationSchema = z.object({
    title: z.string().min(1).max(512).optional(),
});
export const updateConversationSchema = z.object({
    title: z.string().min(1).max(512),
});
/** PATCH /api/conversations/:id — 可单独改标题、单独改置顶，或二者同时传 */
export const patchConversationSchema = z
    .object({
    title: z.string().min(1).max(512).optional(),
    pinned: z.boolean().optional(),
})
    .refine((d) => d.title !== undefined || d.pinned !== undefined, {
    message: "至少需要 title 或 pinned 之一",
});
export const chatRoleSchema = z.nativeEnum(ChatRole);
export const messageContentSchema = z.string().trim().min(1).max(200000);
export const messageMetadataSchema = z.record(z.string(), z.unknown()).nullable().optional();
export const createMessageSchema = z.object({
    conversationId: conversationIdSchema,
    role: chatRoleSchema.default(ChatRole.user),
    content: messageContentSchema,
    metadata: messageMetadataSchema,
});
/** POST /api/conversations/:id/messages — 追加用户提问并以 SSE 流式返回助手回复 */
export const postConversationMessageBodySchema = z.object({
    content: messageContentSchema,
    /** Web 生成的 turnId，贯穿 BFF → Brain；缺省时服务端兜底 */
    turnId: z.string().uuid().optional(),
});

/** POST /api/conversations/:id/turns/:turnId/cancel */
export const cancelTurnBodySchema = z.object({
    reason: z.enum(["cancelled", "superseded"]).default("cancelled"),
});

export const turnIdParamSchema = z.string().uuid();
export const listMessagesQuerySchema = z.object({
    conversationId: conversationIdSchema,
    cursor: z.cuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
