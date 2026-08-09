import { END, START, StateGraph } from "@langchain/langgraph";
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
import { getCompiledKmSlotGraph } from "@/agentflow/agents/online/knowledge-manager";
import {
  runPlanSlotJoinNode,
  runPlanMergeNode,
} from "@/agentflow/agents/online/plan-fanout";
import { runPlanCacheResolveNode } from "@/agentflow/agents/online/plan-fanout/cache-resolve";
import {
  runPlanSlotPostNode,
  runPlanDagNode,
  getCompiledToolSlotGraph,
} from "@/agentflow/agents/online/tool-orchestrator";
import { runCorpusEditNode } from "@/agentflow/agents/online/hitl-write";
import { runVaultWorkspaceNode } from "@/agentflow/agents/online/vault-write";
import {
  runPreparePipelineMemory,
  runPrepareTurnStart,
} from "@/agentflow/agents/online/prepare-turn-start";
import {
  runRepeatQuestionGuard,
  runRepeatRespondEarlyNode,
} from "@/agentflow/agents/online/repeat-question-guard";
import { runPersistTurnEnd } from "@/agentflow/agents/online/persist-turn-end";
import {
  PipelineGraphAnnotation,
  type PipelineGraphState,
} from "./state";
import {
  routeAfterIntake,
  routeAfterPlanCacheResolve,
  routeAfterPlanSlotJoin,
  routeAfterPlanMerge,
  routeAfterContentOrganizer,
  routeAfterContentSummarizer,
  routeAfterPrepareMemory,
  routeAfterRepeat,
} from "./routes";

/**
 * 单槽子图若直接挂父图，invoke 会把整份 Pipeline 状态（含 history LastValue）写回；
 * 并行 Send 时触发 INVALID_CONCURRENT_GRAPH_UPDATE。只透传工人补丁通道。
 */
const asFanOutSlotNode = (compiled: {
  invoke: (state: PipelineGraphState) => Promise<PipelineGraphState>;
}) => {
  return async (
    state: PipelineGraphState
  ): Promise<Partial<PipelineGraphState>> => {
    const out = await compiled.invoke(state);
    const patches = out.fanOutSlotPatches ?? [];
    /** 子图内 reducer 可能叠上父级残留；工人每次只应追加本槽最新一条 */
    const last = patches.length > 0 ? patches[patches.length - 1]! : null;
    return {
      fanOutSlotPatches: last ? [last] : [],
      slotRuntimeById: out.slotRuntimeById ?? {},
      ...(out.turnAborted ? { turnAborted: true as const } : {}),
    };
  };
};

/**
 * intake → planCacheResolve → Send(每槽 km|list|mem|tool|summarize|vault_workspace|corpus_edit ∥ dag ∥ userFactSide)
 *   kmRetrieve / toolRetrieve = 单槽子图壳；list/mem/summarize/vaultWorkspace/corpusEdit 扁平
 *     → planSlotJoin →（可选全局 B 再批 Send ≤1）→ planSlotPost → planMerge
 * → contentOrganizer → contentSummarizer? → analyst
 */
const buildPipelineGraph = () => {
  return new StateGraph(PipelineGraphAnnotation)
    .addNode("prepareTurnStart", runPrepareTurnStart)
    .addNode("repeatQuestionGuard", runRepeatQuestionGuard)
    .addNode("repeatRespondEarly", runRepeatRespondEarlyNode)
    .addNode("preparePipelineMemory", runPreparePipelineMemory)
    .addNode("intake", runIntakeNode)
    .addNode("planCacheResolve", runPlanCacheResolveNode)
    .addNode("listRetriever", runListRetrieverNode)
    .addNode("kmRetrieve", asFanOutSlotNode(getCompiledKmSlotGraph()))
    .addNode("listRetrieve", runListRetrieveNode)
    .addNode("memRetrieve", runMemRetrieveNode)
    .addNode("toolRetrieve", asFanOutSlotNode(getCompiledToolSlotGraph()))
    .addNode("summarizeSlot", runSummarizeSlotNode)
    .addNode("vaultWorkspace", runVaultWorkspaceNode)
    .addNode("corpusEdit", runCorpusEditNode)
    .addNode("planSlotJoin", runPlanSlotJoinNode)
    .addNode("planSlotPost", runPlanSlotPostNode)
    .addNode("planDag", runPlanDagNode)
    .addNode("userFactSide", runUserFactSideNode)
    .addNode("planMerge", runPlanMergeNode)
    .addNode("contentSummarizer", runContentSummarizerNode)
    .addNode("contentOrganizer", runContentOrganizerNode)
    .addNode("analyst", runAnalystNode)
    .addNode("userFact", userFactNode)
    .addNode("respondEarly", runRespondEarlyNode)
    .addNode("persistTurnEnd", runPersistTurnEnd)
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
    .addEdge("vaultWorkspace", "planSlotJoin")
    .addEdge("corpusEdit", "planSlotJoin")
    .addEdge("userFactSide", "planSlotJoin")
    .addEdge("planDag", "planSlotJoin")
    .addConditionalEdges("planSlotJoin", routeAfterPlanSlotJoin)
    .addEdge("planSlotPost", "planMerge")
    .addConditionalEdges("planMerge", routeAfterPlanMerge)
    .addConditionalEdges("contentOrganizer", routeAfterContentOrganizer)
    .addConditionalEdges("contentSummarizer", routeAfterContentSummarizer)
    .addEdge("analyst", "persistTurnEnd")
    .addEdge("respondEarly", "persistTurnEnd")
    .addEdge("persistTurnEnd", END);
};

let compiledGraph: ReturnType<
  ReturnType<typeof buildPipelineGraph>["compile"]
> | null = null;

export const getCompiledPipelineGraph = () => {
  if (!compiledGraph) {
    compiledGraph = buildPipelineGraph().compile({ name: "fambrain-pipeline" });
  }
  return compiledGraph;
};
