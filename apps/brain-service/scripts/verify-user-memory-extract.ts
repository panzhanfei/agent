/**
 * 静默用户记忆：schema 合法化（无 Ollama）。
 * pnpm --filter @fambrain/brain-service run verify:user-memory-extract
 */
import assert from "node:assert/strict";
import { legalizeExtractedUserMemoryFacts } from "../src/agentflow/agents/online/user-memory-extract";

const high = legalizeExtractedUserMemoryFacts(
  {
    facts: [
      {
        factKey: "Preferred Language",
        label: "偏好语言",
        value: "TypeScript",
        confidence: 0.9,
      },
      {
        factKey: "noise",
        label: "噪声",
        value: "x",
        confidence: 0.5,
      },
      {
        factKey: "",
        label: "无 key",
        value: "丢弃",
        confidence: 0.99,
      },
    ],
  },
  0.85
);

assert.equal(high.length, 1);
assert.equal(high[0]!.factKey, "preferred_language");
assert.equal(high[0]!.value, "TypeScript");

const empty = legalizeExtractedUserMemoryFacts({ facts: "bad" }, 0.85);
assert.deepEqual(empty, []);

const nullish = legalizeExtractedUserMemoryFacts(null, 0.85);
assert.deepEqual(nullish, []);

console.log("verify:user-memory-extract ok");
