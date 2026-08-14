import { describe, expect, it } from "vitest";
import { tokensToSparseVector, tokenToSparseIndex } from "./qdrant-sparse";

describe("tokensToSparseVector", () => {
  it("sorts unique indices and sums TF on collision", () => {
    const a = tokenToSparseIndex("alpha");
    const vec = tokensToSparseVector(["alpha", "beta", "alpha"]);
    expect(vec.indices).toEqual([...vec.indices].sort((x, y) => x - y));
    expect(new Set(vec.indices).size).toBe(vec.indices.length);
    const ai = vec.indices.indexOf(a);
    expect(vec.values[ai]).toBe(2);
  });

  it("empty tokens → empty sparse", () => {
    const vec = tokensToSparseVector([]);
    expect(vec.indices).toEqual([]);
    expect(vec.values).toEqual([]);
  });
});
