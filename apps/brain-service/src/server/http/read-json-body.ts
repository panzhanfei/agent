import type { IncomingMessage } from "node:http";

/** 读取 JSON request body（空 body → {}） */
export const readJsonBody = async (
    req: IncomingMessage,
    maxBytes = 512000
): Promise<unknown> => {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buf.length;
        if (total > maxBytes) {
            throw new Error("payload too large");
        }
        chunks.push(buf);
    }
    if (chunks.length === 0) return {};
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};
