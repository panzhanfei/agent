import { createHash } from "node:crypto";
import { tokenizeForRecall } from "./recall-tokenize";

export type QdrantSparseVector = {
  indices: number[];
  values: number[];
};

/** token → uint32；冲突时合并 TF。 */
export const tokenToSparseIndex = (token: string): number => {
  const buf = createHash("sha256").update(token).digest();
  return buf.readUInt32BE(0);
};

export const tokensToSparseVector = (tokens: string[]): QdrantSparseVector => {
  const tf = new Map<number, number>();
  for (const token of tokens) {
    const idx = tokenToSparseIndex(token);
    tf.set(idx, (tf.get(idx) ?? 0) + 1);
  }
  const indices = [...tf.keys()].sort((a, b) => a - b);
  return {
    indices,
    values: indices.map((i) => tf.get(i)!),
  };
};

export const textToSparseVector = (...parts: string[]): QdrantSparseVector => {
  return tokensToSparseVector(tokenizeForRecall(...parts));
};
