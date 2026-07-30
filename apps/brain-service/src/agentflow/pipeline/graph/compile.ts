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
import { runKmRetrieveNode } from "@/agentflow/agents/online/knowledge-manager";
import {
  runPlanSlotJoinNode,
  runPlanMergeNode,
} from "@/agentflow/agents/online/plan-fanout";
import { runPlanCacheResolveNode } from "@/agentflow/agents/online/plan-fanout/cache-resolve";
import {
  runPlanSlotPostNode,
  runPlanDagNode,
  runToolRetrieveNode,
} from "@/agentflow/agents/online/tool-orchestrator";
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
  routeAfterPlanMerge,
  routeAfterContentOrganizer,
  routeAfterContentSummarizer,
  routeAfterPrepareMemory,
  routeAfterRepeat,
} from "./routes";

/**
 * intake → planCacheResolve（facet+hits 全量缓存）→ Send(每槽 km|list|mem|tool|summarize ∥ dag ∥ userFactSide)
 *   kmRetrieve（FC）/ listRetrieve / memRetrieve / toolRetrieve / summarizeSlot / userFactSide
 *     → planSlotJoin → planSlotPost(post-retrieval) → planMerge
 *   planDag ────────────────────────────────────────────────→ planMerge
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
    .addNode("kmRetrieve", runKmRetrieveNode)
    .addNode("listRetrieve", runListRetrieveNode)
    .addNode("memRetrieve", runMemRetrieveNode)
    .addNode("toolRetrieve", runToolRetrieveNode)
    .addNode("summarizeSlot", runSummarizeSlotNode)
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
    .addEdge("userFactSide", "planSlotJoin")
    .addEdge("planSlotJoin", "planSlotPost")
    .addEdge("planSlotPost", "planMerge")
    .addEdge("planDag", "planMerge")
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
