#!/usr/bin/env node
/**
 * API E2E：文件 HITL 契约（jobId / 双消息 / 新 QA 顶替 workspace / 保留 save_offer）。
 *
 *   pnpm --filter @fambrain/brain-service run e2e:api:file-hitl
 */
import { makeEvalMemoPdf } from "./eval-memo-pdf";
import { createWebSession } from "./web-session";

const stamp = Date.now().toString(36);

type Action = {
  label?: string;
  disabled?: boolean;
  clientHandler?: string;
};

const actionsOf = (messages: unknown[], fileJobId?: string): Action[] => {
  const out: Action[] = [];
  for (const raw of messages) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as {
      fileJobId?: string;
      blocks?: Array<{
        type?: string;
        actions?: Action[];
      }>;
    };
    if (fileJobId && m.fileJobId !== fileJobId) continue;
    for (const b of m.blocks ?? []) {
      if (b.type === "actions") out.push(...(b.actions ?? []));
    }
  }
  return out;
};

const main = async () => {
  const session = await createWebSession();
  console.log(`[e2e:file-hitl] base=${session.base}`);

  const convA = await session.createConversation(`e2e-file-jobid-${stamp}`);
  const missing = await session.postChatSse(convA, "确定入库", {
    resume: { prompt: "__FAMBRAIN_VAULT_SAVE_CONFIRM__" },
  });
  if (missing.status !== 400) {
    throw new Error(`expected 400 missing jobId, got ${missing.status} ${missing.text.slice(0, 200)}`);
  }
  const empty = await session.postChatSse(convA, "确定入库", {
    resume: { jobId: "", prompt: "__FAMBRAIN_VAULT_SAVE_CONFIRM__" },
  });
  if (empty.status !== 400) {
    throw new Error(`expected 400 empty jobId, got ${empty.status} ${empty.text.slice(0, 200)}`);
  }
  console.log("[e2e:file-hitl] OK resume-requires-jobid");

  const convB = await session.createConversation(`e2e-file-ws-qa-${stamp}`);
  const list = await session.postChatSse(convB, "我的原文库");
  if (!list.paused || !list.jobId) {
    throw new Error(
      `workspace list missing pause jobId=${list.jobId ?? "none"} paused=${list.paused}`
    );
  }
  const qa = await session.postChatSse(convB, "你好");
  if (qa.status !== 200) {
    throw new Error(`QA after workspace failed ${qa.status}`);
  }
  const msgsB = await session.listMessages(convB);
  const wsActions = actionsOf(msgsB, list.jobId);
  if (wsActions.length === 0) {
    throw new Error("workspace actions missing after QA");
  }
  if (!wsActions.every((a) => a.disabled === true)) {
    throw new Error(
      `workspace actions should be disabled: ${JSON.stringify(wsActions)}`
    );
  }
  console.log("[e2e:file-hitl] OK workspace-superseded-by-qa");

  const convC = await session.createConversation(`e2e-file-save-${stamp}`);
  const batchId = await session.extractPdfFile("eval-memo.pdf", makeEvalMemoPdf());
  const offer = await session.postChatSse(convC, "请总结这个附件", {
    attachmentBatchId: batchId,
  });
  if (
    !offer.paused ||
    !offer.jobId ||
    !offer.sawMainComplete ||
    !/确定入库|写入原文库|Save/.test(offer.answer)
  ) {
    throw new Error(
      `save_offer missing paused=${offer.paused} jobId=${offer.jobId ?? "none"} main=${offer.sawMainComplete} answer=${offer.answer.slice(0, 200)}`
    );
  }
  console.log(`[e2e:file-hitl] OK save-offer-dual-message jobId=${offer.jobId}`);

  const keepQa = await session.postChatSse(convC, "你好");
  if (keepQa.status !== 200) {
    throw new Error(`QA after save_offer failed ${keepQa.status}`);
  }
  const msgsC = await session.listMessages(convC);
  const saveActions = actionsOf(msgsC, offer.jobId);
  if (saveActions.length === 0) {
    throw new Error("save_offer actions missing after QA");
  }
  if (!saveActions.some((a) => a.disabled !== true && /确定入库|Save/.test(a.label ?? ""))) {
    throw new Error(
      `save_offer confirm should stay enabled: ${JSON.stringify(saveActions)}`
    );
  }
  console.log("[e2e:file-hitl] OK save-offer-survives-qa");

  const cancel = await session.postChatSse(convC, "取消入库", {
    resume: {
      jobId: offer.jobId,
      prompt: "__FAMBRAIN_VAULT_SAVE_CANCEL__",
    },
  });
  if (cancel.status !== 200 || cancel.paused) {
    throw new Error(
      `cancel save_offer failed status=${cancel.status} paused=${cancel.paused}`
    );
  }
  console.log("[e2e:file-hitl] OK save-offer-cancel");
  console.log("[e2e:file-hitl] PASS");
};

main().catch((e) => {
  console.error("[e2e:file-hitl] FAIL", e);
  process.exit(1);
});
