import type { AgentPipelineContext, DbChatTurn } from "@fambrain/brain-types";

/** BullMQ pipeline 任务载荷 */
export type PipelineJobPayload = {
    history: DbChatTurn[];
    context: AgentPipelineContext;
};

/** Redis pub/sub 推给 web SSE 中继的事件 */
export type PipelineJobStreamEvent =
    | { type: "step"; name: string; status: "running" | "done" }
    | { type: "thinking"; text: string }
    | { type: "assistant"; text: string }
    | { type: "error"; message: string }
    | { type: "retrieval_meta"; cacheHit: boolean }
    | {
          type: "main_turn_complete";
          answer: string;
      }
    | {
          type: "paused";
          turnId: string;
          kind: "vault_wait";
          answer: string;
          jobId?: string;
      }
    | {
          type: "pipeline_done";
          answer: string;
          retrievalCacheHit?: boolean;
          paused?: boolean;
          jobId?: string;
      };

export type PipelineJobResult = {
    answer: string;
    retrievalCacheHit?: boolean;
    paused?: boolean;
    jobId?: string;
};
