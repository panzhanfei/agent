/**
 * 按 path 增量维护 Qdrant：删旧 chunk →（可选）写入新 chunk。
 * 相对 indexCorpusDocuments 的整库 delete+重建，供单文件 HITL / 局部更新。
 */
import { Document } from "@langchain/core/documents";
import type { Logger } from "pino";
import { isCorpusNoisePath } from "../paths";
import { CORPUS_DENSE_VECTOR_SIZE, getQdrantClient } from "../qdrant";
import {
  corpusCollectionName,
  createOllamaEmbeddings,
  ensureCorpusCollection,
  upsertCorpusDocumentBatch,
} from "./corpus-vector";
import {
  getEmbedIndexOptions,
  mapEmbedBatches,
} from "./embed-batches";
import type { EmbedIndexOptions } from "./interface";

const normalizeRepoPath = (repoPath: string): string =>
  repoPath.replace(/\\/g, "/").replace(/^\.\//, "").trim();

export const deleteCorpusVectorsByPath = async (
  corpusUserId: string,
  repoPath: string
): Promise<{ deleted: boolean; collectionName: string }> => {
  const collectionName = corpusCollectionName(corpusUserId);
  const pathKey = normalizeRepoPath(repoPath);
  if (!pathKey) return { deleted: false, collectionName };

  const client = getQdrantClient();
  try {
    await client.delete(collectionName, {
      wait: true,
      filter: {
        must: [{ key: "path", match: { value: pathKey } }],
      },
    });
    return { deleted: true, collectionName };
  } catch {
    return { deleted: false, collectionName };
  }
};

/**
 * 按 path 更新向量：先删该 path 全部 chunk；docs 非空则 embed 写入。
 * docs 为空（清空文件）或噪声路径 → 只删不写。
 */
export const upsertCorpusDocumentsByPath = async (
  corpusUserId: string,
  repoPath: string,
  docs: Document[],
  logger: Logger,
  options: EmbedIndexOptions = getEmbedIndexOptions()
): Promise<{
  collectionName: string;
  chunkCount: number;
  deleted: boolean;
}> => {
  const pathKey = normalizeRepoPath(repoPath);
  const collectionName = corpusCollectionName(corpusUserId);

  const { deleted } = await deleteCorpusVectorsByPath(corpusUserId, pathKey);
  logger.info(
    {
      step: "path_upsert_delete",
      corpusUserId,
      collectionName,
      path: pathKey,
      deleted,
    },
    "corpus path index: deleted prior chunks"
  );

  if (docs.length === 0 || isCorpusNoisePath(pathKey)) {
    return { collectionName, chunkCount: 0, deleted };
  }

  const withPath = docs.map((d, i) => {
    const meta = {
      ...(d.metadata ?? {}),
      path: pathKey,
      corpusUserId,
      chunkIndex:
        typeof d.metadata?.chunkIndex === "number" ? d.metadata.chunkIndex : i,
    };
    return new Document({
      id: d.id ?? `${corpusUserId}:${pathKey}:${i}`,
      pageContent: d.pageContent,
      metadata: meta,
    });
  });

  await ensureCorpusCollection(collectionName, CORPUS_DENSE_VECTOR_SIZE);
  const embeddings = createOllamaEmbeddings();
  await mapEmbedBatches(
    withPath,
    logger,
    (batch) =>
      upsertCorpusDocumentBatch(collectionName, corpusUserId, batch, embeddings),
    options
  );
  logger.info(
    {
      step: "path_upsert_add",
      corpusUserId,
      collectionName,
      path: pathKey,
      chunkCount: withPath.length,
    },
    "corpus path index: added chunks"
  );
  return { collectionName, chunkCount: withPath.length, deleted };
};
