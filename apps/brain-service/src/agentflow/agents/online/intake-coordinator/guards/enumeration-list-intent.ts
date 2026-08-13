/**
 * 列举分页：按槽设置 executor=list_corpus，从 history assistant blocks 补页码。
 * 不再用口语 regex 猜意图；意图来自 Intake LLM 的 enumerationControl，
 * 或 UI 按钮 prompt 的精确匹配（ENUMERATION_ACTION_PROMPTS）。
 */
import {
    EMPLOYERS_SLOT,
    PROJECTS_SLOT,
    type CompositeRetrievalSlot,
} from "@/agentflow/agents/online/intake-coordinator/composite";
import {
    ENUMERATION_EXHAUSTIVE_PAGE_SIZE,
    ENUMERATION_PREVIEW_PAGE_SIZE,
} from "@/agentflow/agents/online/corpus-lister/list";
import { resolveEnumerationTarget } from "@/agentflow/agents/online/intake-coordinator";
import type { DbChatTurn } from "@fambrain/brain-types";
import {
    matchUiEnumerationPrompt,
    resolveEnumerationPagination,
    type EnumerationControl,
    type EnumerationListKind,
} from "@/agentflow/agents/online/corpus-lister/enumeration";
import {
    deriveCompositeSlotsFromPathPlan,
    deriveRetrievalPlanFromPathPlan,
    type ExecutionStep,
    type PathPlan,
} from "@/agentflow/agents/online/intake-coordinator/path-plan";
import type {
    EnumerationListIntent,
    RoutedIntakeDecision,
} from "./interface";
import { resolveIntakeGraphRouteMode } from "@/agentflow/agents/online/intake-coordinator/pipeline";

export type { EnumerationListIntent } from "./interface";

const isListAction = (
    action: EnumerationControl["action"] | undefined
): action is "continue" | "exhaustive" =>
    action === "continue" || action === "exhaustive";

const defaultEnumerationControl = (
    slot: CompositeRetrievalSlot
): EnumerationControl => {
    const listKind =
        slot.enumerationControl?.listKind ??
        (resolveEnumerationTarget({
            label: slot.label,
            searchQuery: slot.searchQuery,
            topics: slot.topics,
            subTasks: slot.subTasks,
            listKind: null,
        }) === "project"
            ? "project"
            : "experience");
    return {
        action: "preview",
        listKind,
        excludeHint: null,
    };
};

const listSlotTemplate = (
    listKind: EnumerationListKind,
    control: EnumerationControl
): CompositeRetrievalSlot => {
    const base =
        listKind === "project" ? { ...PROJECTS_SLOT } : { ...EMPLOYERS_SLOT };
    return {
        ...base,
        enumerationControl: control,
        executor: "list_corpus",
        enumerationPage: 1,
        enumerationPageSize: ENUMERATION_EXHAUSTIVE_PAGE_SIZE,
        subTasks: [base.label],
    };
};

/** 合成单槽 list 路由（UI exact-match / 脚本用）；直接构造 pathPlan.steps */
export const buildEnumerationListDecision = (input: {
    userQuestion: string;
    listKind: EnumerationListKind;
    listIntent: EnumerationListIntent;
    page: number;
    pageSize: number;
    excludeHint?: string | null;
}): RoutedIntakeDecision => {
    const action: EnumerationControl["action"] =
        input.listIntent === "continue" ? "continue" : "exhaustive";
    const control: EnumerationControl = {
        action,
        listKind: input.listKind,
        excludeHint: input.excludeHint ?? null,
    };
    const slot = listSlotTemplate(input.listKind, control);
    slot.enumerationPage = input.page;
    slot.enumerationPageSize = input.pageSize;
    const listStep: ExecutionStep = {
        id: String(slot.id),
        kind: "list",
        label: slot.label,
        searchQuery: slot.searchQuery,
        queryType: "enumeration",
        topics: [...slot.topics],
        identityField: null,
        enumerationControl: control,
        enumerationPage: input.page,
        enumerationPageSize: input.pageSize,
        toolId: "compose_enumeration",
        dataSource: "corpus",
    };
    const pathPlan: PathPlan = {
        steps: [listStep],
    };
    const answerOrder = [listStep.id];
    const compositeSlots = deriveCompositeSlotsFromPathPlan(pathPlan);
    const retrievalPlan = deriveRetrievalPlanFromPathPlan(pathPlan);
    const routed: RoutedIntakeDecision = {
        intent: "retrieve_and_answer",
        searchQuery: slot.searchQuery,
        subTasks: [slot.label],
        topics: [...slot.topics],
        language: "zh",
        confidence: 0.95,
        queryType: "enumeration",
        clarifyingQuestion: null,
        briefReply: null,
        retrievalPlan,
        pathPlan,
        answerOrder,
        composeMode: "qa",
        userFactKey: null,
        userFactLabel: null,
        userFactValue: null,
        routeMode: "listRetriever",
        compositeSlots,
        routeReason: "intake_path_plan",
        routePlanSource: "intake_path_plan",
        listIntent:
            input.listIntent === "preview" ? "exhaustive" : input.listIntent,
        enumerationPage: input.page,
        enumerationPageSize: input.pageSize,
        enumerationListKind: input.listKind,
    };
    routed.routeMode = resolveIntakeGraphRouteMode(routed);
    return routed;
};

const resolvePageForControl = (
    control: EnumerationControl,
    history: DbChatTurn[],
    pageSize: number
): { page: number; pageSize: number } =>
    resolveEnumerationPagination(control, history, pageSize);

const enrichSlotExecutor = (
    slot: CompositeRetrievalSlot,
    history: DbChatTurn[]
): CompositeRetrievalSlot => {
    if (slot.queryType !== "enumeration") {
        return {
            ...slot,
            executor: "km_retrieve",
            enumerationControl: null,
        };
    }

    const control = slot.enumerationControl ?? defaultEnumerationControl(slot);
    const defaultPageSize =
        control.action === "preview"
            ? ENUMERATION_PREVIEW_PAGE_SIZE
            : ENUMERATION_EXHAUSTIVE_PAGE_SIZE;
    const { page, pageSize: resolvedSize } = resolvePageForControl(
        control,
        history,
        slot.enumerationPageSize ?? defaultPageSize
    );
    return {
        ...slot,
        executor: "list_corpus",
        enumerationControl: control,
        enumerationPage: page,
        enumerationPageSize: resolvedSize,
        queryType: "enumeration",
    };
};

/**
 * Intake guard ⑦：列举分页 / per-slot executor。
 *
 * 凡 queryType=enumeration（preview / continue / exhaustive）→ list_corpus。
 * 续页页码从 history 末条 assistant enumeration block 读取。
 */
export const applyEnumerationSlotGuard = (
    decision: RoutedIntakeDecision,
    userQuestion: string,
    history: DbChatTurn[]
): RoutedIntakeDecision => {
    if (decision.intent !== "retrieve_and_answer") return decision;
    if (decision.routeMode === "respondEarly") {
        return decision;
    }

    let slots = [...(decision.compositeSlots ?? [])];
    let retrievalPlan = [...(decision.retrievalPlan ?? [])];

    const uiControl = matchUiEnumerationPrompt(userQuestion);
    const hasListControl =
        slots.some((s) => isListAction(s.enumerationControl?.action)) ||
        retrievalPlan.some((p) =>
            isListAction(p.enumerationControl?.action)
        );

    if (uiControl && !hasListControl) {
        const listIntent: EnumerationListIntent =
            uiControl.action === "continue" ? "continue" : "exhaustive";
        const { page, pageSize } = resolvePageForControl(
            uiControl,
            history,
            ENUMERATION_EXHAUSTIVE_PAGE_SIZE
        );
        return buildEnumerationListDecision({
            userQuestion,
            listKind: uiControl.listKind,
            listIntent,
            page,
            pageSize,
            excludeHint: uiControl.excludeHint,
        });
    }

    if (retrievalPlan.length > 0 && slots.length > 0) {
        slots = slots.map((slot) => {
            if (slot.queryType !== "enumeration" || slot.enumerationControl) {
                return slot;
            }
            const planItem = retrievalPlan.find((p) => p.label === slot.label);
            const planCtrl = planItem?.enumerationControl;
            if (!planCtrl || planItem?.queryType !== "enumeration") return slot;
            return { ...slot, enumerationControl: planCtrl };
        });
    }

    if (
        slots.length === 1 &&
        slots[0]!.queryType === "enumeration" &&
        !slots[0]!.enumerationControl &&
        retrievalPlan[0]?.enumerationControl
    ) {
        slots[0] = {
            ...slots[0]!,
            enumerationControl: retrievalPlan[0]!.enumerationControl,
        };
    }

    const enriched = slots.map((s) => enrichSlotExecutor(s, history));

    const firstList = enriched.find((s) => s.executor === "list_corpus");
    const listIntent: EnumerationListIntent | null | undefined = firstList
        ? firstList.enumerationControl?.action === "continue"
            ? "continue"
            : "exhaustive"
        : decision.listIntent ?? null;

    const next: RoutedIntakeDecision = {
        ...decision,
        compositeSlots: enriched,
        listIntent: listIntent ?? null,
        enumerationPage: firstList?.enumerationPage ?? decision.enumerationPage,
        enumerationPageSize:
            firstList?.enumerationPageSize ?? decision.enumerationPageSize,
        enumerationListKind:
            firstList?.enumerationControl?.listKind ??
            decision.enumerationListKind,
        queryType: firstList
            ? decision.queryType === "tech" ||
              decision.queryType === "identity" ||
              decision.queryType === "external_link"
                ? decision.queryType
                : "enumeration"
            : decision.queryType,
        routeMode: "planFanOut",
    };
    next.routeMode = resolveIntakeGraphRouteMode(next);
    return next;
};
