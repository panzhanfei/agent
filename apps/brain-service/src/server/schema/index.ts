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
    }),
});
