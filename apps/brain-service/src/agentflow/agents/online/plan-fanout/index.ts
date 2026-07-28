/**
 * Plan fan-out：LangGraph Send 并行 km / list / dag / remember，再 planMerge 汇合。
 *
 *   intake → Send(kmRetrieve | listRetrieve | planDag | userFactSide)
 *            kmRetrieve ──┐
 *            listRetrieve ┼→ planSlotPost ─┐
 *            userFactSide ┘               ├→ planMerge → contentOrganizer
 *            planDag ─────────────────────┘
 */

export { fanOutPlanWorkers, pathHasHybridDag, describeFanOutPlan } from "./fan-out";
export {
  mergeStepResultsByAnswerOrder,
  buildDagStepResults,
  mergeCompositeWithDagSteps,
} from "./merge-composite-dag";
export type { PlanSlotsPatch, PlanDagPatch } from "./interface";
export {
  runKmRetrieveNode,
  runListRetrieveNode,
  runPlanSlotPostNode,
  runPlanDagNode,
  runPlanMergeNode,
  runUserFactSideNode,
} from "./nodes";
