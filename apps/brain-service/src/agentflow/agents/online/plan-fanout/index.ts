/**
 * Plan fan-out：每槽 Send（km|list）∥ dag ∥ remember → join → tools → planMerge。
 *
 *   intake → Send(kmRetrieve×N | listRetrieve×M | planDag | userFactSide)
 *            kmRetrieve ──┐
 *            listRetrieve ┼→ planSlotJoin → planSlotPost ─┐
 *            userFactSide ┘                               ├→ planMerge → contentOrganizer
 *            planDag ─────────────────────────────────────┘
 *
 * 单槽工人内：retrieve → FC →（km 失败且有 refinedQuery 时）局部重检一次。
 */

export { fanOutPlanWorkers, pathHasHybridDag, describeFanOutPlan } from "./fan-out";
export {
  mergeStepResultsByAnswerOrder,
  buildDagStepResults,
  mergeCompositeWithDagSteps,
} from "./merge-composite-dag";
export type {
  PlanSlotsPatch,
  PlanDagPatch,
  PlanSlotWorkerPatch,
} from "./interface";
export {
  runKmRetrieveNode,
  runListRetrieveNode,
  runPlanSlotJoinNode,
  runPlanSlotPostNode,
  runPlanDagNode,
  runPlanMergeNode,
  runUserFactSideNode,
} from "./nodes";
