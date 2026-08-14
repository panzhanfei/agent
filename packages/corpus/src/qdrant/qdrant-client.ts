import { createHash } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import { resolveQdrantUrl } from "@fambrain/brain-config/service-url";

export const DENSE_VECTOR_NAME = "dense";
export const SPARSE_VECTOR_NAME = "sparse";
/** nomic-embed-text */
export const CORPUS_DENSE_VECTOR_SIZE = 768;

let cachedClient: QdrantClient | null = null;
let cachedUrl = "";

export const getQdrantUrl = (): string => resolveQdrantUrl();

export const getQdrantClient = (): QdrantClient => {
  const url = getQdrantUrl();
  if (!cachedClient || cachedUrl !== url) {
    cachedClient = new QdrantClient({ url, checkCompatibility: false });
    cachedUrl = url;
  }
  return cachedClient;
};

export const qdrantReady = async (timeoutMs = 3000): Promise<boolean> => {
  try {
    const res = await fetch(`${getQdrantUrl()}/readyz`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const pointIdFromKey = (key: string): string => {
  const hex = createHash("sha256").update(key).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};
