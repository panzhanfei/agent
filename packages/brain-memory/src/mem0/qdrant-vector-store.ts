/**
 * Mem0 OSS VectorStore 适配：Qdrant HTTP（与语料共用服务，独立 unnamed-vector collection）。
 * mem0ai 自带 Qdrant provider 仍调已移除的 client.search，js-client 1.19 不可用，故自研完整适配。
 */
import { getQdrantClient } from "@fambrain/corpus";

type Mem0Payload = Record<string, unknown>;

type VectorRow = {
  id: string;
  payload: Mem0Payload;
  score?: number;
};

type QdrantFilter = {
  must: Array<{ key: string; match: { value: string | number | boolean } }>;
};

const filtersToQdrant = (
  filters?: Record<string, unknown>
): QdrantFilter | undefined => {
  if (!filters || Object.keys(filters).length === 0) return undefined;
  const must: QdrantFilter["must"] = [];
  for (const [key, value] of Object.entries(filters)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      must.push({ key, match: { value } });
    }
  }
  return must.length > 0 ? { must } : undefined;
};

const asPayload = (raw: unknown): Mem0Payload => {
  if (!raw || typeof raw !== "object") return {};
  return { ...(raw as Mem0Payload) };
};

export class QdrantMem0VectorStore {
  private readonly collectionName: string;
  private readonly dimension: number;
  private telemetryUserId = "fambrain-mem0";

  constructor(config: { collectionName: string; dimension: number }) {
    this.collectionName = config.collectionName;
    this.dimension = config.dimension;
  }

  async initialize(): Promise<void> {
    const client = getQdrantClient();
    const exists = await client.collectionExists(this.collectionName);
    if (!exists.exists) {
      await client.createCollection(this.collectionName, {
        vectors: {
          size: this.dimension,
          distance: "Cosine",
        },
      });
    }
    try {
      await client.createPayloadIndex(this.collectionName, {
        field_name: "userId",
        field_schema: "keyword",
        wait: true,
      });
    } catch {
      /* 已有 index 时忽略 */
    }
  }

  async insert(
    vectors: number[][],
    ids: string[],
    payloads: Mem0Payload[]
  ): Promise<void> {
    if (ids.length !== vectors.length || payloads.length !== vectors.length) {
      throw new Error("QdrantMem0VectorStore.insert: length mismatch");
    }
    for (const v of vectors) {
      if (v.length !== this.dimension) {
        throw new Error(
          `Vector dimension mismatch. Expected ${this.dimension}, got ${v.length}`
        );
      }
    }
    await getQdrantClient().upsert(this.collectionName, {
      wait: true,
      points: vectors.map((vector, i) => ({
        id: ids[i]!,
        vector,
        payload: payloads[i] ?? {},
      })),
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
    const res = await getQdrantClient().query(this.collectionName, {
      query,
      limit: Math.max(1, limit),
      filter: filtersToQdrant(filters),
      with_payload: true,
    });
    return (res.points ?? []).map((hit) => ({
      id: String(hit.id),
      payload: asPayload(hit.payload),
      score: typeof hit.score === "number" ? hit.score : undefined,
    }));
  }

  async get(vectorId: string): Promise<VectorRow | null> {
    const results = await getQdrantClient().retrieve(this.collectionName, {
      ids: [vectorId],
      with_payload: true,
    });
    const row = results[0];
    if (!row) return null;
    return {
      id: String(row.id),
      payload: asPayload(row.payload),
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
    await getQdrantClient().upsert(this.collectionName, {
      wait: true,
      points: [{ id: vectorId, vector, payload }],
    });
  }

  async delete(vectorId: string): Promise<void> {
    await getQdrantClient().delete(this.collectionName, {
      wait: true,
      points: [vectorId],
    });
  }

  async deleteCol(): Promise<void> {
    const client = getQdrantClient();
    try {
      await client.deleteCollection(this.collectionName);
    } catch {
      /* collection 可能不存在 */
    }
    await this.initialize();
  }

  async list(
    filters?: Record<string, unknown>,
    limit = 100
  ): Promise<[VectorRow[], number]> {
    const response = await getQdrantClient().scroll(this.collectionName, {
      limit,
      filter: filtersToQdrant(filters),
      with_payload: true,
      with_vector: false,
    });
    const rows = (response.points ?? []).map((point) => ({
      id: String(point.id),
      payload: asPayload(point.payload),
    }));
    return [rows, rows.length];
  }

  async getUserId(): Promise<string> {
    return this.telemetryUserId;
  }

  async setUserId(userId: string): Promise<void> {
    this.telemetryUserId = userId;
  }
}
