#!/usr/bin/env node
/**
 * 进程内 E2E：runPipelineStream + UI exact-match「我的原文库」。
 * 不依赖 Web；vault list 走 Intake UI 路由 + 图内 interrupt（不经 LLM）。
 */
import { bootstrapBrainServiceRuntime } from "@/config/index";
import { runPipelineStream } from "@/agentflow/pipeline";
import type { AgentPipelineContext } from "@fambrain/brain-types";

await bootstrapBrainServiceRuntime();

const corpusUserId =
  process.env.FAMBRAIN_CORPUS_USER_ID?.trim() || "panzhanfei";

const context: AgentPipelineContext = {
  actorUserId: corpusUserId,
  corpusUserId,
  displayName: "E2E",
  conversationId: `e2e-vault-${Date.now()}`,
};

const history = [
  { role: "user" as const, content: "我的原文库" },
];

let answer = "";
let paused = false;
const gen = runPipelineStream(history, context);
while (true) {
  const next = await gen.next();
  if (next.done) {
    answer = next.value?.answer ?? answer;
    paused = Boolean(next.value?.paused);
    break;
  }
  if (next.value.type === "assistant") {
    answer += next.value.text;
  }
  if (next.value.type === "paused") {
    paused = true;
    if (next.value.answer) answer = next.value.answer;
  }
}

console.log("[e2e:inprocess] answer preview:", answer.slice(0, 240));
if (!paused || !/原文库|Workspace|暂无文件|项：/.test(answer)) {
  console.error("[e2e:inprocess] FAIL paused=", paused);
  process.exit(1);
}
console.log("[e2e:inprocess] PASS");
