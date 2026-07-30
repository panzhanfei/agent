import type { CompositeCachePlan } from "@/agentflow/cache";
import type { CompositeRetrievalSlot } from "@/agentflow/agents/online/intake-coordinator/composite/interface";

export type ExecuteKmSlotSubInput = {
    corpusUserId: string;
    plan: CompositeCachePlan | null;
    slot: CompositeRetrievalSlot;
    /** FC 重检：忽略 plan.resolvedSub，live retrieve + write */
    liveRetrieve?: boolean;
};
