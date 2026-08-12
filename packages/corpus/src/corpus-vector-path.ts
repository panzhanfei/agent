/**
 * 按 path 增量维护 Chroma：删旧 chunk →（可选）写入新 chunk。
 * 相对 indexCorpusDocuments 的整库 delete+重建，供单文件 HITL / 局部更新。
 */
import { Document } from "@langchain/core/documents";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient, DefaultEmbeddingFunction } from "chromadb";
import type { Logger } from "pino";
import {
  addDocumentsWithEmbedLimit,
  getEmbedIndexOptions,
  type EmbedIndexOptions,
} from "./embed-batches";
import {
  chromaLibArgs,
  corpusCollectionName,
  createOllamaEmbeddings,
  getChromaServerUrl,
} from "./corpus-vector";

const normalizeRepoPath = (repoPath: string): string =>
  repoPath.replace(/\\/g, "/").replace(/^\.\//, "").trim();

export const deleteCorpusVectorsByPath = async (
  corpusUserId: string,
  repoPath: string
): Promise<{ deleted: boolean; collectionName: string }> => {
  const collectionName = corpusCollectionName(corpusUserId);
  const pathKey = normalizeRepoPath(repoPath);
  if (!pathKey) return { deleted: false, collectionName };

  const client = new ChromaClient({ path: getChromaServerUrl() });
  try {
    const collection = await client.getCollection({
      name: collectionName,
      embeddingFunction: new DefaultEmbeddingFunction(),
    });
    await collection.delete({ where: { path: pathKey } });
    return { deleted: true, collectionName };
  } catch {
    // collection 不存在或 where 无匹配
    return { deleted: false, collectionName };
  }
};

/**
 * 按 path 更新向量：先删该 path 全部 chunk；docs 非空则 embed 写入。
 * docs 为空（清空文件）→ 只删不写。
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

  if (docs.length === 0) {
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

  const vectorStore = await Chroma.fromExistingCollection(
    createOllamaEmbeddings(),
    chromaLibArgs(collectionName)
  ).catch(async () => {
    return new Chroma(createOllamaEmbeddings(), chromaLibArgs(collectionName));
  });

  await addDocumentsWithEmbedLimit(vectorStore, withPath, logger, options);
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
