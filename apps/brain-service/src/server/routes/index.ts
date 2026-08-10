import type { IncomingMessage, ServerResponse } from "node:http";
import { getLangSmithStatus } from "@fambrain/brain-config/langsmith";
import {
    getRetrievalCacheBackend,
    isRedisConfigured,
    pingRedis,
} from "@fambrain/infra";
import type { AgentStreamEvent } from "@fambrain/brain-types";
import { abortTurn } from "@/agentflow/execution";
import { runAgentStream } from "@/agentflow";
import {
    getAttachmentBatch,
    turnAttachmentsFromBatch,
} from "@/agentflow/agents/offline/doc-parser";
import { requireAuth } from "@/server/middleware";
import { pipelineStreamBodySchema } from "@/server/schema";
import { initSseResponse, readJsonBody, writeSse } from "@/server/http";

export { handlePipelineCancel } from "./pipeline-cancel";
export { handlePipelineCorpusEditResume } from "./pipeline-corpus-edit-resume";
export {
  handlePipelineCorpusEditPropose,
  handlePipelineCorpusEditContent,
} from "./pipeline-corpus-edit-propose";

const streamEventName = (ev: AgentStreamEvent): string => {
    return ev.type;
};
export const handlePipelineStream = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "method not allowed" }));
        return;
    }
    const userId = await requireAuth(req, res);
    if (!userId)
        return;
    let body: unknown;
    try {
        body = await readJsonBody(req);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "invalid body";
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: msg }));
        return;
    }
    const parsed = pipelineStreamBodySchema.safeParse(body);
    if (!parsed.success) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: parsed.error.message }));
        return;
    }
    if (parsed.data.context.actorUserId !== userId) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "无权以该用户身份调用 Agent" }));
        return;
    }
    const turnId =
        parsed.data.context.turnId?.trim() ||
        (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `turn-${Date.now()}`);
    const batchId = parsed.data.context.attachmentBatchId?.trim();
    let turnAttachments = undefined as
        | ReturnType<typeof turnAttachmentsFromBatch>
        | undefined;
    if (batchId) {
        const batch = getAttachmentBatch(batchId, parsed.data.context.actorUserId);
        if (!batch) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    error: "附件批次已过期或不存在，请重新选择文件后再发送",
                })
            );
            return;
        }
        turnAttachments = turnAttachmentsFromBatch(batch);
        if (turnAttachments.length === 0) {
            res.writeHead(422, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    error:
                        batch.files.find((f) => f.error)?.error ??
                        "附件未能抽取有效文本",
                })
            );
            return;
        }
    }
    const context = {
        ...parsed.data.context,
        turnId,
        ...(batchId ? { attachmentBatchId: batchId } : {}),
        ...(turnAttachments ? { turnAttachments } : {}),
    };
    initSseResponse(res);
    let completed = false;
    const onClientGone = () => {
        if (!completed) {
            abortTurn(turnId, "cancelled");
        }
    };
    req.on("close", onClientGone);
    res.on("close", onClientGone);
    try {
        const gen = runAgentStream(parsed.data.history, context);
        let pipelineResult: {
            answer: string;
            blocks?: import("@fambrain/brain-types").AssistantMessageBlock[];
            citations?: import("@fambrain/brain-types").Citation[];
            retrievalCacheHit?: boolean;
            retrievalPaths?: string[];
            timing?: import("@fambrain/brain-types").PipelineTiming;
            aborted?: boolean;
            abortReason?: "cancelled" | "superseded";
            turnId?: string;
            logs?: import("@fambrain/brain-types").PipelineLogEntry[];
            steps?: import("@fambrain/brain-types").TurnStepEvent[];
        } | undefined;
        while (true) {
            const next = await gen.next();
            if (next.done) {
                pipelineResult = next.value;
                break;
            }
            writeSse(res, streamEventName(next.value), next.value);
        }
        completed = true;
        writeSse(res, "pipeline_done", {
            answer: pipelineResult?.answer ?? "",
            blocks: pipelineResult?.blocks,
            citations: pipelineResult?.citations,
            retrievalCacheHit: pipelineResult?.retrievalCacheHit,
            retrievalPaths: pipelineResult?.retrievalPaths,
            timing: pipelineResult?.timing,
            logs: pipelineResult?.logs,
            steps: pipelineResult?.steps,
            aborted: pipelineResult?.aborted,
            abortReason: pipelineResult?.abortReason,
            turnId: pipelineResult?.turnId ?? turnId,
        });
    }
    catch (e) {
        completed = true;
        console.error(e);
        const msg = e instanceof Error ? e.message : "Agent pipeline failed";
        writeSse(res, "error", { message: msg });
        writeSse(res, "pipeline_done", { answer: "", timing: undefined, turnId });
    }
    finally {
        req.off("close", onClientGone);
        res.off("close", onClientGone);
        res.end();
    }
};
export const handleHealth = async (_req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const langSmith = getLangSmithStatus();
    const redisOk = await pingRedis();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
        ok: true,
        service: "fambrain-agents",
        redis: {
            configured: isRedisConfigured(),
            ping: redisOk,
            retrievalCacheBackend: getRetrievalCacheBackend(),
        },
        langSmith: {
            enabled: langSmith.enabled,
            project: langSmith.project,
            apiKeyConfigured: langSmith.apiKeyConfigured,
            uiUrl: langSmith.uiUrl,
        },
    }));
};
export const handleNotFound = (res: ServerResponse): void => {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
};
