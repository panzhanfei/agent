import type { PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/interface";

export type ExecuteDagPlanOptions = {
  /** 首遍 / 上轮节点结果；再批时复用可复用节点 */
  seedToolResults?: PipelineToolResults | null;
  /** 全局 B 改过的节点（根）；会扩展为下游闭包 */
  forceRerunIds?: ReadonlySet<string> | readonly string[];
};
