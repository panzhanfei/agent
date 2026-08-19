#!/usr/bin/env node
/**
 * 进程内 E2E：orchestrateAgentStream + UI exact-match「我的原文库」。
 * 不依赖 Web；vault list 走 Intake UI 路由 + 文件子线 interrupt（不经 LLM）。
 */
import { bootstrapBrainServiceRuntime } from "@/config/index";
import { orchestrateAgentStream } from "@/agentflow/pipeline";
import type { AgentPipelineContext } from "@fambrain/brain-types";
import { prisma } from "@fambrain/db";

await bootstrapBrainServiceRuntime();

const corpusUserId =
  process.env.FAMBRAIN_CORPUS_USER_ID?.trim() || "panzhanfei";

const conv = await prisma.conversation.create({
  data: { title: `e2e-vault-${Date.now()}` },
  select: { id: true },
});

const context: AgentPipelineContext = {
  actorUserId: corpusUserId,
  corpusUserId,
  displayName: "E2E",
  conversationId: conv.id,
};

const history = [
  { role: "user" as const, content: "我的原文库" },
];

let answer = "";
let paused = false;
let jobId: string | undefined;
const gen = orchestrateAgentStream(history, context);
while (true) {
  const next = await gen.next();
  if (next.done) {
    answer = next.value?.answer ?? answer;
    paused = Boolean(next.value?.paused);
    jobId = next.value?.jobId ?? jobId;
    break;
  }
  if (next.value.type === "assistant") {
    answer += next.value.text;
  }
  if (next.value.type === "paused") {
    paused = true;
    if (next.value.answer) answer = next.value.answer;
    jobId = next.value.jobId ?? jobId;
  }
}

console.log("[e2e:inprocess] answer preview:", answer.slice(0, 240));
if (!paused || !jobId || !/原文库|Workspace|暂无文件|项：/.test(answer)) {
  console.error("[e2e:inprocess] FAIL paused=", paused, "jobId=", jobId);
  process.exit(1);
}
console.log("[e2e:inprocess] PASS jobId=", jobId);
