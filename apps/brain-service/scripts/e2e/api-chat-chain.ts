#!/usr/bin/env node
/**
 * API E2E 对话主链：登录 → 会话 → 多轮问答（姓名 / 年龄 / 手机）。
 * 覆盖 Web BFF → brain pipeline，不是 vault 旁路。
 */
import { createWebSession } from "./web-session";

const stamp = Date.now().toString(36);

type Turn = {
  id: string;
  question: string;
  answerRe: RegExp;
};

const TURNS: Turn[] = [
  {
    id: "name",
    question: "我的名字是什么？",
    answerRe: /潘展飞/,
  },
  {
    id: "age",
    question: "我今年多大？",
    answerRe: /\d{2}|岁|1993/,
  },
  {
    id: "phone",
    question: "我的手机号多少？",
    answerRe: /13679383435/,
  },
];

const main = async () => {
  const session = await createWebSession();
  console.log(`[e2e:chat] base=${session.base} turns=${TURNS.length}`);

  const convId = await session.createConversation(`e2e-chat-${stamp}`);
  const results: Array<{
    id: string;
    pass: boolean;
    latencyMs: number;
    detail: string;
  }> = [];

  for (const turn of TURNS) {
    const t0 = Date.now();
    try {
      const answer = await session.postChat(convId, turn.question);
      const latencyMs = Date.now() - t0;
      if (!answer.trim()) {
        throw new Error("empty answer");
      }
      if (!turn.answerRe.test(answer)) {
        throw new Error(
          `answer mismatch\n---\n${answer.slice(0, 500)}\n---`
        );
      }
      console.log(`[e2e:chat] OK ${turn.id} (${latencyMs}ms)`);
      results.push({
        id: turn.id,
        pass: true,
        latencyMs,
        detail: answer.slice(0, 160).replace(/\n/g, " "),
      });
    } catch (e) {
      const latencyMs = Date.now() - t0;
      const detail = e instanceof Error ? e.message : String(e);
      console.error(`[e2e:chat] FAIL ${turn.id}: ${detail}`);
      results.push({ id: turn.id, pass: false, latencyMs, detail });
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log(
    `[e2e:chat] done pass=${results.length - failed.length}/${results.length}`
  );
  if (failed.length > 0) {
    process.exit(1);
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
