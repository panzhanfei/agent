import type { SubQuestionAnalyzeInput } from "@/agentflow/agents/online/information-analyst/analyze";
import { resolveAnalystQueryProfile } from "@/agentflow/agents/online/information-analyst/limits";
import type { InformationAnalystResult } from "@/agentflow/agents/online/information-analyst/interface";
import { toolRunToAnalystResult } from "@/agentflow/agents/online/information-analyst/pick-tool-result";
import type { ExecutionPlanNode } from "@/agentflow/agents/online/tool-orchestrator/interface";
import { resolveIdentityFieldFromPlan } from "@/agentflow/tools/catalog";
import { invokeTool } from "@/agentflow/tools/invoke";
import type { OrchestratedToolId } from "./interface";

/** 命中则跳过 Analyst LLM，改走确定性编排工具 */
export const resolveOrchestratedTool = (
    input: SubQuestionAnalyzeInput
): OrchestratedToolId | null => {
    if (input.hits.length === 0 || input.coverage === "none") return null;

    const profile =
        input.queryType ??
        resolveAnalystQueryProfile({
            userQuestion: input.userQuestion,
            subTasks: [input.userQuestion],
        });

    if (profile === "enumeration") return "compose_enumeration";

    if (profile === "external_link") return "extract_external_links_from_hits";

    if (profile === "identity") {
        const fieldSpec = resolveIdentityFieldFromPlan({
            identityField: input.identityField ?? null,
        });
        if (fieldSpec?.toolId === "compute_tenure_from_hits") {
            return "compute_tenure_from_hits";
        }
        if (fieldSpec?.toolId === "compute_age_from_hits") {
            return "compute_age_from_hits";
        }
        if (fieldSpec?.toolId === "extract_identity_from_hits") {
            return "extract_identity_from_hits";
        }
    }

    return null;
};

/** 运行编排工具；无匹配返回 null。生产执行走 invoke。 */
export const runOrchestratedSubQuestion = async (
    input: SubQuestionAnalyzeInput
): Promise<InformationAnalystResult | null> => {
    const toolId = resolveOrchestratedTool(input);
    if (!toolId || toolId === "search_web" || toolId === "translate_text") {
        return null;
    }

    const node: ExecutionPlanNode = {
        id: input.slotId ?? "sub",
        label: input.userQuestion,
        dataSource:
            toolId === "compute_age_from_hits" ||
            toolId === "compute_tenure_from_hits"
                ? "compute"
                : "corpus",
        toolId,
        searchQuery: input.searchQuery,
        queryType: input.queryType,
        topics: input.topics,
        field:
            input.identityField ??
            (toolId === "compute_age_from_hits" ? "age" : null),
        deps: [],
        hitsOverride: input.hits,
        enumerationMetaOverride: input.enumerationMeta ?? null,
    };

    const result = await invokeTool(node, {
        corpusUserId: "",
        actorUserId: "",
        userQuestion: input.userQuestion,
        parentUserQuestion: input.parentUserQuestion,
        asOfDate: input.asOfDate ?? new Date().toISOString().slice(0, 10),
        language: input.language,
        hits: input.hits,
        prior: {},
        notes: input.notes,
        enumerationMeta: input.enumerationMeta,
        listIntent: input.listIntent,
        decisionTopics: input.topics,
    });
    return toolRunToAnalystResult(result);
};
