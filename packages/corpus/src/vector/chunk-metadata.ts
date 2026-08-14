import { z } from "zod";
import type { ChunkMetadata } from "./interface";

export type { ChunkMetadata };

/** 写入 Qdrant payload 的 chunk metadata（入库前须通过校验） */
export const chunkMetadataSchema = z.object({
    corpusUserId: z.string().min(1),
    path: z.string().min(1),
    title: z.string().min(1),
    chunkIndex: z.number().int().min(0),
});
