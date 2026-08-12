/**
 * Mem0 OSS VectorStore 适配：Chroma HTTP（与语料共用服务，独立 collection）。
 * mem0ai 的 langchain provider 缺 get/list，无法支撑 delete 去重，故自研完整适配。
 */
import { ChromaClient, type Collection, type Metadata } from "chromadb";
import { resolveChromaServerUrl } from "@fambrain/brain-config/service-url";

type Mem0Payload = Record<string, unknown>;

type VectorRow = {
    id: string;
    payload: Mem0Payload;
    score?: number;
};

const toChromaMetadata = (payload: Mem0Payload): Metadata => {
    const meta: Metadata = {};
    for (const [key, value] of Object.entries(payload)) {
        if (value === null || value === undefined) continue;
        if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        ) {
            meta[key] = value;
            continue;
        }
        try {
            meta[key] = JSON.stringify(value);
        } catch {
            meta[key] = String(value);
        }
    }
    return meta;
};

const fromChromaMetadata = (
    meta: Metadata | null | undefined,
    document?: string | null
): Mem0Payload => {
    const payload: Mem0Payload = { ...(meta ?? {}) };
    if (
        (payload.data === undefined || payload.data === "") &&
        typeof document === "string" &&
        document.length > 0
    ) {
        payload.data = document;
    }
    return payload;
};

const filtersToWhere = (
    filters?: Record<string, unknown>
): Record<string, string | number | boolean> | undefined => {
    if (!filters || Object.keys(filters).length === 0) return undefined;
    const where: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(filters)) {
        if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        ) {
            where[key] = value;
        }
    }
    return Object.keys(where).length > 0 ? where : undefined;
};

export class ChromaMem0VectorStore {
    private readonly collectionName: string;
    private readonly dimension: number;
    private readonly chromaUrl: string;
    private collection: Collection | null = null;
    private telemetryUserId = "fambrain-mem0";

    constructor(config: {
        collectionName: string;
        dimension: number;
        chromaUrl?: string;
    }) {
        this.collectionName = config.collectionName;
        this.dimension = config.dimension;
        this.chromaUrl = config.chromaUrl ?? resolveChromaServerUrl();
    }

    async initialize(): Promise<void> {
        const client = new ChromaClient({ path: this.chromaUrl });
        this.collection = await client.getOrCreateCollection({
            name: this.collectionName,
            metadata: {
                "hnsw:space": "cosine",
                dimension: this.dimension,
                purpose: "mem0_user_memories",
            },
        });
    }

    private async col(): Promise<Collection> {
        if (!this.collection) await this.initialize();
        return this.collection!;
    }

    async insert(
        vectors: number[][],
        ids: string[],
        payloads: Mem0Payload[]
    ): Promise<void> {
        if (ids.length !== vectors.length || payloads.length !== vectors.length) {
            throw new Error("ChromaMem0VectorStore.insert: length mismatch");
        }
        for (const v of vectors) {
            if (v.length !== this.dimension) {
                throw new Error(
                    `Vector dimension mismatch. Expected ${this.dimension}, got ${v.length}`
                );
            }
        }
        const collection = await this.col();
        await collection.upsert({
            ids,
            embeddings: vectors,
            documents: payloads.map((p) =>
                typeof p.data === "string" ? p.data : ""
            ),
            metadatas: payloads.map(toChromaMetadata),
        });
    }

    async search(
        query: number[],
        limit = 10,
        filters?: Record<string, unknown>
    ): Promise<VectorRow[]> {
        if (query.length !== this.dimension) {
            throw new Error(
                `Query dimension mismatch. Expected ${this.dimension}, got ${query.length}`
            );
        }
        const collection = await this.col();
        const where = filtersToWhere(filters);
        const raw = await collection.query({
            queryEmbeddings: [query],
            nResults: Math.max(1, limit),
            ...(where ? { where } : {}),
            include: ["metadatas", "documents", "distances"],
        });
        const ids = raw.ids?.[0] ?? [];
        const metadatas = raw.metadatas?.[0] ?? [];
        const documents = raw.documents?.[0] ?? [];
        const distances = raw.distances?.[0] ?? [];
        const results: VectorRow[] = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            if (!id) continue;
            const distance = distances[i];
            // cosine distance → similarity-ish score（越大越相似，供排序）
            const score =
                typeof distance === "number" ? 1 - distance : undefined;
            results.push({
                id,
                payload: fromChromaMetadata(
                    metadatas[i] as Metadata | null,
                    documents[i]
                ),
                score,
            });
        }
        return results;
    }

    async get(vectorId: string): Promise<VectorRow | null> {
        const collection = await this.col();
        const raw = await collection.get({
            ids: [vectorId],
            include: ["metadatas", "documents"],
        });
        const id = raw.ids?.[0];
        if (!id) return null;
        return {
            id,
            payload: fromChromaMetadata(
                raw.metadatas?.[0] as Metadata | null,
                raw.documents?.[0]
            ),
        };
    }

    async update(
        vectorId: string,
        vector: number[],
        payload: Mem0Payload
    ): Promise<void> {
        if (vector.length !== this.dimension) {
            throw new Error(
                `Vector dimension mismatch. Expected ${this.dimension}, got ${vector.length}`
            );
        }
        const collection = await this.col();
        await collection.update({
            ids: [vectorId],
            embeddings: [vector],
            documents: [typeof payload.data === "string" ? payload.data : ""],
            metadatas: [toChromaMetadata(payload)],
        });
    }

    async delete(vectorId: string): Promise<void> {
        const collection = await this.col();
        await collection.delete({ ids: [vectorId] });
    }

    async deleteCol(): Promise<void> {
        const client = new ChromaClient({ path: this.chromaUrl });
        try {
            await client.deleteCollection({ name: this.collectionName });
        } catch {
            /* collection 可能不存在 */
        }
        this.collection = null;
        await this.initialize();
    }

    async list(
        filters?: Record<string, unknown>,
        limit = 100
    ): Promise<[VectorRow[], number]> {
        const collection = await this.col();
        const where = filtersToWhere(filters);
        const raw = await collection.get({
            ...(where ? { where } : {}),
            limit,
            include: ["metadatas", "documents"],
        });
        const rows: VectorRow[] = [];
        for (let i = 0; i < (raw.ids?.length ?? 0); i++) {
            const id = raw.ids![i];
            if (!id) continue;
            rows.push({
                id,
                payload: fromChromaMetadata(
                    raw.metadatas?.[i] as Metadata | null,
                    raw.documents?.[i]
                ),
            });
        }
        return [rows, rows.length];
    }

    async getUserId(): Promise<string> {
        return this.telemetryUserId;
    }

    async setUserId(userId: string): Promise<void> {
        this.telemetryUserId = userId;
    }
}
