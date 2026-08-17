/**
 * Pipeline interrupt 载荷。
 * - vault_wait：可 Command Resume
 * - gen_pause：停止生成后 discard，不可 Resume
 */
export type PipelinePauseKind = "vault_wait" | "gen_pause";

export type PipelinePauseValue = {
  kind: PipelinePauseKind;
  answer: string;
  blocks: import("@fambrain/brain-types").AssistantMessageBlock[];
};

/** vault_wait 的 Resume 载荷；gen_pause 不使用 Command。 */
export type PipelineResumePayload = {
  kind: "vault_action";
  prompt: string;
  name?: string;
};
