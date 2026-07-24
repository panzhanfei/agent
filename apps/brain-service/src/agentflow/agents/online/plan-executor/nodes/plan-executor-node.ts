/**
 * Plan Executor：按 pathPlan 调度 km/list/tool/dag，内嵌 per-step FC。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import { emptyPathPlan } from "@/agentflow/agents/online/intake-coordinator/path-plan";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan/interface";
import { runPerStepFactChecks } from "@/agentflow/agents/online/fact-checker/check-step";
import { runRetrievalNode } from "@/agentflow/agents/online/knowledge-manager";
import {
    runDagExecutorNode,
    runToolOrchestratorNode,
} from "@/agentflow/agents/online/tool-orchestrator";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/types";
import {
    buildDagStepResults,
    mergeCompositeWithDagSteps,
    mergeStepResultsByAnswerOrder,
} from "../merge-composite-dag";

const pathHasHybridDag = (state: PipelineGraphState): boolean => {
    const pathPlan = state.decision?.pathPlan ?? emptyPathPlan();
    return (
        pathPlan.dag.some((d) => d.template === "hybrid_multi_source") ||
        (state.decision?.executionPlan?.length ?? 0) > 0
    );
};

/**
 * LangGraph `planExecutor` 节点。
 *
 * - 有 compositeSlots → slots 检索 + per-step FC + post-retrieval tools
 * - 有 hybrid dag → executeDagPlan（可与 slots 并存，按 answerOrder 合并 stepResults）
 */
export const runPlanExecutorNode = async (
    state: PipelineGraphState
): Promise<Partial<PipelineGraphState>> => {
    const decision = state.decision;
    if (!decision) {
        return { error: "缺少入口路由决策" };
    }

    const pathPlan = decision.pathPlan ?? emptyPathPlan();
    const hasSlots = (decision.compositeSlots?.length ?? 0) > 0;
    const hasDag = pathHasHybridDag(state);
    const answerOrder = decision.answerOrder ?? [];

    logAgentOut("PlanExecutor", "进入", {
        composeMode: decision.composeMode,
        km: pathPlan.km.length,
        list: pathPlan.list.length,
        tool: pathPlan.tool.length,
        dag: pathPlan.dag.map((d) => d.template),
        hasSlots,
        hasDag,
    });

    if (!hasSlots && !hasDag) {
        return { error: "pathPlan 为空且无 compositeSlots" };
    }

    let working: PipelineGraphState = { ...state };
    let slotStepResults: StepResult[] = [];
    let mergedToolResults: PipelineToolResults = {
        ...(state.toolResults ?? {}),
    };

        if (hasSlots) {
        working = {
            ...working,
            decision: {
                ...decision,
                compositeSlots: decision.compositeSlots,
            },
        };

        let retrievalPatch = await runRetrievalNode(working);
        if (retrievalPatch.error) {
            return retrievalPatch;
        }
        working = { ...working, ...retrievalPatch };

        const runFc = async (st: PipelineGraphState) =>
            runPerStepFactChecks({
                userQuestion: st.userQuestion,
                decision: st.decision!,
                compositeSubResults: st.compositeSubResults ?? [],
                retryCount: st.retryCount,
                retrievalCacheHit: st.retrievalCacheHit,
            });

        let fc = await runFc(working);

        if (fc.refinedDecision && working.retryCount < 1) {
            logAgentOut("PlanExecutor", "per-step FC 局部重试", {
                refinedSearchQuery: fc.refinedDecision.searchQuery,
            });
            working = {
                ...working,
                decision: fc.refinedDecision,
                checkerPassed: false,
                retryCount: working.retryCount,
            };
            retrievalPatch = await runRetrievalNode(working);
            if (retrievalPatch.error) return retrievalPatch;
            working = {
                ...working,
                ...retrievalPatch,
                retryCount: working.retryCount + 1,
            };
            fc = await runFc(working);
        }

        slotStepResults = fc.stepResults;
        working = {
            ...working,
            stepResults: fc.stepResults,
            checkerPassed: true,
            notes: [working.notes, fc.notes].filter(Boolean).join(" ") || working.notes,
        };

        const toolPatch = await runToolOrchestratorNode(working);
        mergedToolResults = {
            ...mergedToolResults,
            ...(toolPatch.toolResults ?? {}),
        };
        working = { ...working, ...toolPatch };
    }

    let dagStepResults: StepResult[] = [];
    if (hasDag) {
        const dagPatch = await runDagExecutorNode(working);
        if (dagPatch.error) return dagPatch;
        dagStepResults = buildDagStepResults(pathPlan, dagPatch);
        mergedToolResults = {
            ...mergedToolResults,
            ...(dagPatch.toolResults ?? {}),
        };

        const dagRuns = pathPlan.dag.filter(
            (d) => d.template === "hybrid_multi_source"
        );
        const compositeMerge =
            hasSlots && dagRuns.length > 0
                ? mergeCompositeWithDagSteps(
                      working,
                      pathPlan,
                      answerOrder,
                      dagRuns,
                      dagPatch
                  )
                : null;

        working = {
            ...working,
            ...dagPatch,
            ...(compositeMerge ?? {}),
            toolResults: mergedToolResults,
        };
    }

    const stepResults = mergeStepResultsByAnswerOrder(
        answerOrder,
        pathPlan,
        slotStepResults,
        dagStepResults
    );

    logAgentOut("PlanExecutor", "完成", {
        stepCount: stepResults.length,
        slotSteps: slotStepResults.length,
        dagSteps: dagStepResults.length,
        toolKeys: Object.keys(mergedToolResults),
        coverage: working.coverage,
    });

    return {
        ...working,
        toolResults: mergedToolResults,
        stepResults,
        checkerPassed: true,
    };
};
