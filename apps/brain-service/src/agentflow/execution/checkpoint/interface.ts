/**
 * 图内 interrupt 载荷。
 * - `vault_wait`：HITL，可 Resume
 * - `gen_pause`：生成停（Pause=停），半截稿即终稿，随后 discard，不可 Resume
 */
export type PipelinePauseKind = "vault_wait" | "gen_pause";

export type PipelinePauseValue = {
  kind: PipelinePauseKind;
  answer: string;
  blocks: import("@fambrain/brain-types").AssistantMessageBlock[];
};

/** 仅原文库按钮可 Resume；生成停不走 Command。 */
export type PipelineResumePayload = { kind: "vault_action"; prompt: string };
