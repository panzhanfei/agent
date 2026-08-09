/**
 * 聊天附件：按 Intake 结构化 attachmentAction 归一 pathPlan / 早退信号。
 * 抽取已在 /documents/extract 完成；此处只决定展示/总结/翻译/入库。
 */
import type { TurnAttachment } from "@fambrain/brain-types";
import type { IntakeRoutingDecision } from "@/agentflow/agents/online/intake-coordinator/contract";
import {
  joinAttachmentTexts,
  ingestStagedAttachmentBatch,
  docParserLogger,
} from "@/agentflow/agents/offline/doc-parser";
import { emptyPathPlan } from "@/agentflow/agents/online/intake-coordinator/path-plan";

export const ATTACHMENT_ACTIONS = [
  "extract",
  "summarize",
  "translate",
  "ingest",
] as const;

export type AttachmentAction = (typeof ATTACHMENT_ACTIONS)[number];

export const parseAttachmentAction = (
  raw: unknown
): AttachmentAction | null => {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if ((ATTACHMENT_ACTIONS as readonly string[]).includes(v)) {
    return v as AttachmentAction;
  }
  return null;
};

export type ApplyAttachmentActionResult = {
  decision: IntakeRoutingDecision;
  /** 直接作答（extract / ingest） */
  answer?: string;
  earlyExit: boolean;
};

const withClarify = (
  decision: IntakeRoutingDecision,
  question: string,
  action: AttachmentAction | null
): ApplyAttachmentActionResult => ({
  decision: {
    ...decision,
    intent: "clarify",
    clarifyingQuestion: question,
    briefReply: null,
    pathPlan: emptyPathPlan(),
    attachmentAction: action,
  },
  earlyExit: true,
});

/**
 * 有 turnAttachments 时：必须有合法 attachmentAction，否则 clarify。
 * extract/ingest → earlyExit；summarize/translate → 改写 pathPlan。
 */
export const applyAttachmentAction = async (input: {
  decision: IntakeRoutingDecision;
  attachments: TurnAttachment[];
  attachmentBatchId?: string;
  actorUserId: string;
  corpusUserId: string;
}): Promise<ApplyAttachmentActionResult> => {
  const { decision, attachments } = input;
  if (attachments.length === 0) {
    return { decision, earlyExit: false };
  }

  const action = parseAttachmentAction(decision.attachmentAction);
  if (!action) {
    return withClarify(
      decision,
      decision.language === "en"
        ? "What should I do with the attached file(s): show extracted text, summarize, translate, or ingest into the knowledge base?"
        : "请说明要对附件做什么：展示抽取原文 / 总结 / 翻译（请注明目标语言）/ 入库到知识库？",
      null
    );
  }

  const text = joinAttachmentTexts(
    attachments.map((a) => ({
      fileName: a.fileName,
      title: a.title,
      text: a.text,
      format: a.format ?? "unknown",
      ok: true,
      textLength: a.textLength ?? a.text.length,
    }))
  );

  if (!text.trim()) {
    return withClarify(
      decision,
      decision.language === "en"
        ? "Could not read text from the attachment(s). Try another file or set OLLAMA_MODEL_VISION for images."
        : "未能从附件读出有效文字。请换文件，或为图片配置支持 vision 的 OLLAMA_MODEL_VISION。",
      action
    );
  }

  if (action === "extract") {
    const header =
      decision.language === "en"
        ? "Extracted text from attachment(s):\n\n"
        : "附件抽取原文：\n\n";
    return {
      decision: {
        ...decision,
        intent: "direct_answer",
        briefReply: null,
        clarifyingQuestion: null,
        pathPlan: emptyPathPlan(),
        attachmentAction: action,
      },
      answer: `${header}${text}`,
      earlyExit: true,
    };
  }

  if (action === "ingest") {
    if (!input.attachmentBatchId) {
      return withClarify(
        decision,
        "附件批次缺失，请重新选择文件后再请求入库。",
        action
      );
    }
    const ingested = await ingestStagedAttachmentBatch({
      batchId: input.attachmentBatchId,
      actorUserId: input.actorUserId,
      corpusUserId: input.corpusUserId,
      indexAfter: true,
      logger: docParserLogger,
    });
    if (!ingested.ok) {
      return {
        decision: {
          ...decision,
          intent: "direct_answer",
          briefReply: null,
          clarifyingQuestion: null,
          pathPlan: emptyPathPlan(),
          attachmentAction: action,
        },
        answer: `入库失败：${ingested.error}`,
        earlyExit: true,
      };
    }
    return {
      decision: {
        ...decision,
        intent: "direct_answer",
        briefReply: null,
        clarifyingQuestion: null,
        pathPlan: emptyPathPlan(),
        attachmentAction: action,
      },
      answer: ingested.summary,
      earlyExit: true,
    };
  }

  if (action === "summarize") {
    // 纯总结：searchQuery 留空（禁止误走 KM）；正文由 contentSummarizer 读 context.turnAttachments
    return {
      decision: {
        ...decision,
        intent: "summarize_content",
        composeMode: "summarize",
        attachmentAction: action,
        clarifyingQuestion: null,
        briefReply: null,
        searchQuery: "",
        pathPlan: emptyPathPlan(),
        topics:
          decision.topics?.length > 0
            ? decision.topics
            : ["attachment"],
      },
      earlyExit: false,
    };
  }

  const fromStep = decision.pathPlan?.steps?.find((s) => s.targetLang?.trim());
  const targetLang =
    fromStep?.targetLang?.trim() ||
    (typeof fromStep?.params?.targetLang === "string"
      ? String(fromStep.params.targetLang).trim()
      : "");
  if (!targetLang) {
    return withClarify(
      decision,
      decision.language === "en"
        ? "Which language should I translate the attachment into? (e.g. en, zh, ja)"
        : "请说明要翻译成哪种语言（如 en / zh / ja）。",
      action
    );
  }

  return {
    decision: {
      ...decision,
      intent: "retrieve_and_answer",
      composeMode: "qa",
      attachmentAction: action,
      clarifyingQuestion: null,
      briefReply: null,
      searchQuery: decision.searchQuery?.trim() || "附件翻译",
      pathPlan: {
        steps: [
          {
            id: "attach-translate",
            kind: "tool",
            label: "附件翻译",
            searchQuery: text,
            queryType: "default",
            topics: ["attachment"],
            toolId: "translate_text",
            dataSource: "user_text",
            targetLang,
            sourceLang: "auto",
          },
        ],
      },
    },
    earlyExit: false,
  };
};
