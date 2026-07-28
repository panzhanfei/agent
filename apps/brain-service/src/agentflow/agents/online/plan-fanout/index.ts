/**
 * Plan fan-out：用 LangGraph Send 并行 km / hybrid dag / remember side-effect，
 * 再在 planMerge 汇合。
 *
 * 图拓扑（routeMode=planFanOut）：
 *   intake → Send(kmRetrieve | planDag | userFactSide)
 *            kmRetrieve → planSlotPost ─┐
 *            planDag ──────────────────┼→ planMerge → contentOrganizer
 *            userFactSide ─────────────┘
 *
 * SSE：整段仍报 `plan_executor`（兼容 eval/UI）；side-effect 另报 `user_fact`。
 */

export { fanOutPlanWorkers, pathHasHybridDag } from "./fan-out";
export {
  mergeStepResultsByAnswerOrder,
  buildDagStepResults,
  mergeCompositeWithDagSteps,
} from "./merge-composite-dag";
export type { PlanSlotsPatch, PlanDagPatch } from "./interface";
export {
  runKmRetrieveNode,
  runPlanSlotPostNode,
  runPlanDagNode,
  runPlanMergeNode,
  runUserFactSideNode,
} from "./nodes";
