import { z } from "zod";

const assistantMessageBlockSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("heading"),
        text: z.string(),
        sectionNo: z.number().optional(),
    }),
    z.object({
        type: z.literal("text"),
        markdown: z.string(),
    }),
    z.object({
        type: z.literal("enumeration"),
        listKind: z.enum(["project", "employer"]),
        items: z.array(
            z.object({
                id: z.string(),
                title: z.string(),
                subtitle: z.string().optional(),
                path: z.string(),
                excerpt: z.string().optional(),
            })
        ),
        total: z.number(),
        shown: z.number(),
        page: z.number(),
        pageSize: z.number(),
        hasMore: z.boolean(),
        startIndex: z.number().optional(),
        paginationHint: z.string().optional(),
    }),
    z.object({
        type: z.literal("actions"),
        actions: z.array(
            z.object({
                id: z.string(),
                label: z.string(),
                prompt: z.string(),
            })
        ),
    }),
]);

const chatTurnSchema = z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    blocks: z.array(assistantMessageBlockSchema).optional(),
});

export const pipelineStreamBodySchema = z.object({
    history: z.array(chatTurnSchema).min(1),
    context: z.object({
        actorUserId: z.string().min(1),
        corpusUserId: z.string().min(1),
        displayName: z.string().min(1),
        conversationId: z.string().min(1),
        /** Web 贯穿的 turnId；缺省时 Brain 兜底生成 */
        turnId: z.string().uuid().optional(),
    }),
});

export const pipelineCancelBodySchema = z.object({
    turnId: z.string().uuid(),
    conversationId: z.string().min(1).optional(),
    reason: z.enum(["cancelled", "superseded"]).default("cancelled"),
});

export const corpusEditResumeBodySchema = z.object({
    proposalId: z.string().min(1),
    action: z.enum(["approve", "reject", "detail"]),
});

export const corpusEditProposeBodySchema = z.object({
    targetPath: z.string().min(1),
    operation: z.enum(["update", "clear", "create"]),
    afterContent: z.string(),
    corpusUserId: z.string().min(1).optional(),
    conversationId: z.string().min(1).optional().nullable(),
});

export const corpusEditContentQuerySchema = z.object({
    targetPath: z.string().min(1),
    corpusUserId: z.string().min(1),
});
