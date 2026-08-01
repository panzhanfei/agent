import { Annotation } from "@langchain/langgraph";
import type { AgentPipelineContext, DbChatTurn } from "@fambrain/brain-types";
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator";
import type { InformationAnalystInput } from "@/agentflow/agents/online/information-analyst";
import type {
    ConfidenceTier,
    CompositeSubRetrieval,
    EnumerationMeta,
} from "@/agentflow/agents/online/knowledge-manager";
import type { CompositeCachePlan } from "@/agentflow/cache";
import type { PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator";
import type { StepResult } from "@/agentflow/agents/online/intake-coordinator/path-plan";
import type {
    PlanDagPatch,
    PlanSlotWorkerPatch,
    PlanSlotsPatch,
} from "@/agentflow/agents/online/plan-fanout/interface";
import type {
    RetryPolicy,
    SlotRuntimeState,
} from "@/agentflow/execution";

/**
 * LangGraph 编排共享状态（Intake → plan fan-out → Compose）。
 * 初始值由 `runtime/initial-state.ts` 的 `buildInitialState()` 注入。
 *
 * fan-out：每槽 Send → fanOutSlotPatches（append）→ planSlotJoin → fanOutSlotPatch → planSlotPost → planMerge。
 */
export const PipelineGraphAnnotation = Annotation.Root({
    history: Annotation<DbChatTurn[]>,
    context: Annotation<AgentPipelineContext>,
    userQuestion: Annotation<string>,
    decision: Annotation<RoutedIntakeDecision | null>,
    hits: Annotation<InformationAnalystInput["hits"]>,
    coverage: Annotation<InformationAnalystInput["coverage"]>,
    notes: Annotation<string | null>,
    confidenceTier: Annotation<ConfidenceTier | null>,
    enumerationMeta: Annotation<EnumerationMeta | null>,
    answer: Annotation<string | null>,
    assistantBlocks: Annotation<AssistantMessageBlock[] | null>,
    error: Annotation<string | null>,
    exitEarly: Annotation<boolean>,
    checkerPassed: Annotation<boolean>,
    retryCount: Annotation<number>,
    memoryBlock: Annotation<string | null>,
    userMemories: Annotation<string[]>,
    intakeHistory: Annotation<DbChatTurn[]>,
    repeatQuestionHit: Annotation<boolean>,
    retrievalCacheHit: Annotation<boolean>,
    retrievalCacheSlotHits: Annotation<number | null>,
    compositeSubResults: Annotation<CompositeSubRetrieval[] | null>,
    compositeIncrementalPlan: Annotation<CompositeCachePlan | null>,
    compositeFacetCacheHits: Annotation<number | null>,
    asOfDate: Annotation<string>,
    toolResults: Annotation<PipelineToolResults | null>,
    stepResults: Annotation<StepResult[] | null>,
    /**
     * 每槽工人补丁（并行 append）。
     * 空数组 `[]` = 清空（join / merge 后）。
     */
    fanOutSlotPatches: Annotation<PlanSlotWorkerPatch[]>({
        reducer: (prev, next) => {
            if (!Array.isArray(next)) return prev;
            if (next.length === 0) return [];
            return prev.concat(next);
        },
        default: () => [],
    }),
    /** planSlotJoin / planSlotPost 汇合后的槽位线补丁 */
    fanOutSlotPatch: Annotation<PlanSlotsPatch | null>({
        reducer: (_prev, next) => next,
        default: () => null,
    }),
    /** planDag 工人补丁 */
    fanOutDagPatch: Annotation<PlanDagPatch | null>({
        reducer: (_prev, next) => next,
        default: () => null,
    }),
    /** 同轮 remember side-effect 确认文案 */
    sideEffectAnswer: Annotation<string | null>({
        reducer: (_prev, next) => next,
        default: () => null,
    }),
    /** 每槽 Send 载荷：当前工人负责的 compositeSlots.id（不持久语义） */
    activeSlotId: Annotation<string | null>({
        reducer: (_prev, next) => next,
        default: () => null,
    }),
    /** 本轮 turn；cancel/supersede 后 aborted=true，禁止写回 */
    turnId: Annotation<string>,
    turnAborted: Annotation<boolean>,
    /** 统一预算初值；分档留待后续 */
    retryPolicy: Annotation<RetryPolicy>,
    /** 槽运行时状态（按 slotId）；工人/join 更新 */
    slotRuntimeById: Annotation<Record<string, SlotRuntimeState>>({
        reducer: (prev, next) => ({ ...prev, ...next }),
        default: () => ({}),
    }),
    /** 全局协调 B 是否已触发过（最多 1 次） */
    globalRebatchUsed: Annotation<boolean>,
    /** Join 后待再批的槽 id（空 = 不进再批 Send） */
    pendingGlobalRebatchSlotIds: Annotation<string[]>({
        reducer: (_prev, next) => next,
        default: () => [],
    }),
    /** Join 后是否再跑 planDag */
    pendingGlobalRebatchDag: Annotation<boolean>({
        reducer: (_prev, next) => next,
        default: () => false,
    }),
});
export type PipelineGraphState = typeof PipelineGraphAnnotation.State;
