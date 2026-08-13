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

/** 节点包 ALS：token / pipeline_log 与 stream 入口同一 store */
const als = withPipelineRunAls;

/**
 * 单槽子图若直接挂父图，invoke 会把整份 Pipeline 状态（含 history LastValue）写回；
 * 并行 Send 时触发 INVALID_CONCURRENT_GRAPH_UPDATE。只透传工人补丁通道。
 */
const asFanOutSlotNode = (compiled: {
  // 子图 CompiledStateGraph.invoke 签名与父状态略有差异，运行时透传 config 即可
  invoke: (state: PipelineGraphState, config?: unknown) => Promise<PipelineGraphState>;
}) => {
  return async (
    state: PipelineGraphState,
    config?: unknown
  ): Promise<Partial<PipelineGraphState>> => {
    const out = await compiled.invoke(state, config);
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
 * intake → planCacheResolve → Send(每槽 km|list|mem|tool|summarize|vault_workspace ∥ dag ∥ userFactSide)
 *   kmRetrieve / toolRetrieve = 单槽子图壳；list/mem/summarize/vaultWorkspace 扁平
 *     → planSlotJoin →（可选全局 B 再批 Send ≤1）→ planSlotPost → planMerge
 * → contentOrganizer → contentSummarizer? → analyst
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
    .addNode(
      "kmRetrieve",
      als(asFanOutSlotNode(getCompiledKmSlotGraph() as never))
    )
    .addNode("listRetrieve", als(runListRetrieveNode))
    .addNode("memRetrieve", als(runMemRetrieveNode))
    .addNode(
      "toolRetrieve",
      als(asFanOutSlotNode(getCompiledToolSlotGraph() as never))
    )
    .addNode("summarizeSlot", als(runSummarizeSlotNode))
    .addNode("vaultWorkspace", als(runVaultWorkspaceNode))
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
    .addEdge("vaultWorkspace", "planSlotJoin")
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
