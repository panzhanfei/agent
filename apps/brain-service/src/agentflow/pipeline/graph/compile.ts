import { END, START, StateGraph } from "@langchain/langgraph";
import { withPipelineRunAls } from "@fambrain/brain-shared/pipeline-run-context";
import { runContentOrganizerNode } from "@/agentflow/agents/online/content-organizer";
import {
  runContentSummarizerNode,
  runSummarizeSlotNode,
} from "@/agentflow/agents/online/content-summarizer";
import { runIntakeNode } from "@/agentflow/agents/online/intake-coordinator";
import { runRespondEarlyNode } from "@/agentflow/agents/online/respond-early";
import {
  userFactNode,
  runUserFactSideNode,
  runMemRetrieveNode,
} from "@/agentflow/agents/online/user-fact";
import { runAnalystNode } from "@/agentflow/agents/online/information-analyst";
import {
  runListRetrieverNode,
  runListRetrieveNode,
} from "@/agentflow/agents/online/corpus-lister";
import { runKmRetrieveNode } from "@/agentflow/agents/online/knowledge-manager";
import {
  runPlanSlotJoinNode,
  runPlanSlotPostNode,
  runPlanMergeNode,
} from "@/agentflow/agents/online/plan-fanout";
import { runPlanCacheResolveNode } from "@/agentflow/agents/online/plan-fanout/cache-resolve";
import { runPlanDagNode } from "@/agentflow/agents/online/dag-executor";
import { runToolRetrieveNode } from "@/agentflow/agents/online/tool-orchestrator";
import { runVaultWorkspaceNode } from "@/agentflow/agents/online/vault-write";
import { runVaultSaveGateNode } from "@/agentflow/agents/online/vault-save-gate";
import { getPipelineCheckpointer } from "@/agentflow/execution";
import {
  runPreparePipelineMemory,
  runPrepareTurnStart,
} from "@/agentflow/agents/online/prepare-turn-start";
import {
  runRepeatQuestionGuard,
  runRepeatRespondEarlyNode,
} from "@/agentflow/agents/online/repeat-question-guard";
import { runPersistTurnEnd } from "@/agentflow/agents/online/persist-turn-end";
import { PipelineGraphAnnotation } from "./state";
import {
  routeAfterIntake,
  routeAfterPlanCacheResolve,
  routeAfterPlanSlotJoin,
  routeAfterPlanMerge,
  routeAfterContentOrganizer,
  routeAfterContentSummarizer,
  routeAfterAnalyst,
  routeAfterPrepareMemory,
  routeAfterRepeat,
} from "./routes";

/** 节点包 ALS：token / pipeline_log 与 stream 入口同一 store */
const als = withPipelineRunAls;

/**
 * intake → planCacheResolve → Send(每槽 km|list|mem|tool|summarize ∥ dag ∥ userFactSide)
 *   km/list/mem/tool/summarize：扁平节点 + emitBudgetedSlotPatch
 *     → planSlotJoin →（可选全局 B 再批 Send ≤1）→ planSlotPost → planMerge
 *     → contentOrganizer → contentSummarizer? → analyst
 *   vaultWorkspace：独占单槽；interrupt 循环；点「结束」或缺槽 → persistTurnEnd
 *   vaultSaveGate：附件/粘贴新材料终稿一次确认入库 → persistTurnEnd；查库摘要不出闸
 */
const buildPipelineGraph = () => {
  return new StateGraph(PipelineGraphAnnotation)
    .addNode("prepareTurnStart", als(runPrepareTurnStart))
    .addNode("repeatQuestionGuard", als(runRepeatQuestionGuard))
    .addNode("repeatRespondEarly", als(runRepeatRespondEarlyNode))
    .addNode("preparePipelineMemory", als(runPreparePipelineMemory))
    .addNode("intake", als(runIntakeNode))
    .addNode("planCacheResolve", als(runPlanCacheResolveNode))
    .addNode("listRetriever", als(runListRetrieverNode))
    .addNode("kmRetrieve", als(runKmRetrieveNode))
    .addNode("listRetrieve", als(runListRetrieveNode))
    .addNode("memRetrieve", als(runMemRetrieveNode))
    .addNode("toolRetrieve", als(runToolRetrieveNode))
    .addNode("summarizeSlot", als(runSummarizeSlotNode))
    .addNode("vaultWorkspace", als(runVaultWorkspaceNode))
    .addNode("vaultSaveGate", als(runVaultSaveGateNode))
    .addNode("planSlotJoin", als(runPlanSlotJoinNode))
    .addNode("planSlotPost", als(runPlanSlotPostNode))
    .addNode("planDag", als(runPlanDagNode))
    .addNode("userFactSide", als(runUserFactSideNode))
    .addNode("planMerge", als(runPlanMergeNode))
    .addNode("contentSummarizer", als(runContentSummarizerNode))
    .addNode("contentOrganizer", als(runContentOrganizerNode))
    .addNode("analyst", als(runAnalystNode))
    .addNode("userFact", als(userFactNode))
    .addNode("respondEarly", als(runRespondEarlyNode))
    .addNode("persistTurnEnd", als(runPersistTurnEnd))
    .addEdge(START, "prepareTurnStart")
    .addEdge("prepareTurnStart", "repeatQuestionGuard")
    .addConditionalEdges("repeatQuestionGuard", routeAfterRepeat)
    .addConditionalEdges("preparePipelineMemory", routeAfterPrepareMemory)
    .addConditionalEdges("intake", routeAfterIntake)
    .addConditionalEdges("planCacheResolve", routeAfterPlanCacheResolve)
    .addEdge("listRetriever", "contentOrganizer")
    .addEdge("userFact", "persistTurnEnd")
    .addEdge("repeatRespondEarly", "persistTurnEnd")
    .addEdge("kmRetrieve", "planSlotJoin")
    .addEdge("listRetrieve", "planSlotJoin")
    .addEdge("memRetrieve", "planSlotJoin")
    .addEdge("toolRetrieve", "planSlotJoin")
    .addEdge("summarizeSlot", "planSlotJoin")
    .addEdge("vaultWorkspace", "persistTurnEnd")
    .addEdge("userFactSide", "planSlotJoin")
    .addEdge("planDag", "planSlotJoin")
    .addConditionalEdges("planSlotJoin", routeAfterPlanSlotJoin)
    .addEdge("planSlotPost", "planMerge")
    .addConditionalEdges("planMerge", routeAfterPlanMerge)
    .addConditionalEdges("contentOrganizer", routeAfterContentOrganizer)
    .addConditionalEdges("contentSummarizer", routeAfterContentSummarizer)
    .addConditionalEdges("analyst", routeAfterAnalyst)
    .addEdge("vaultSaveGate", "persistTurnEnd")
    .addEdge("respondEarly", "persistTurnEnd")
    .addEdge("persistTurnEnd", END);
};

let compiledGraph: ReturnType<
  ReturnType<typeof buildPipelineGraph>["compile"]
> | null = null;

export const getCompiledPipelineGraph = () => {
  if (!compiledGraph) {
    compiledGraph = buildPipelineGraph().compile({
      name: "fambrain-pipeline",
      checkpointer: getPipelineCheckpointer(),
    });
  }
  return compiledGraph;
};

/** 单测换 MemorySaver 后须重 compile，否则仍持有旧 checkpointer */
export const resetCompiledPipelineGraph = (): void => {
  compiledGraph = null;
};
