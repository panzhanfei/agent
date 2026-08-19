/**
 * 主图节点：只把文件信封放到 state，不 interrupt、不写 FileJob。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { shouldRunFileAgent } from "@/agentflow/agents/sideline/file/decide";
import { buildFileEnvelopeFromPipelineState } from "@/agentflow/agents/sideline/file/handoff";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";

export const runFileHandoffNode = (
  state: PipelineGraphState
): Partial<PipelineGraphState> => {
  const envelope = buildFileEnvelopeFromPipelineState(state);
  if (!envelope || !shouldRunFileAgent(envelope)) {
    logAgentOut("FileHandoff", "跳过", { via: "fileHandoff" });
    return { fileEnvelope: null };
  }
  logAgentOut("FileHandoff", "交棒", {
    via: "fileHandoff",
    task: envelope.task,
  });
  return { fileEnvelope: { envelope } };
};
