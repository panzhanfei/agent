import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import { shouldRunFileAgent } from "../decide";
import type { FileAgentEnvelope } from "../interface";
import { parseVaultWorkspaceParams } from "../vault";

export const shouldHandoffFromPipelineState = (
  state: Pick<PipelineGraphState, "answer" | "decision" | "error">
): boolean => {
  if (state.error) return false;
  const envelope = buildFileEnvelopeFromPipelineState(state);
  return Boolean(envelope && shouldRunFileAgent(envelope));
};

export const buildFileEnvelopeFromPipelineState = (
  state: Pick<PipelineGraphState, "answer" | "decision">
): FileAgentEnvelope | null => {
  const d = state.decision;
  if (!d) return null;
  const language = d.language === "en" ? "en" : "zh";
  const vaultStep = d.pathPlan?.steps?.find((s) => s.kind === "vault_workspace");
  if (vaultStep) {
    const workspaceOp =
      parseVaultWorkspaceParams(
        (vaultStep.params as Record<string, unknown> | undefined) ?? null
      ) ?? {
        operation: "list" as const,
        targetPath: String(vaultStep.searchQuery ?? "").trim() || "",
      };
    return {
      task: "workspace",
      draft: "",
      attachmentAction: d.attachmentAction ?? null,
      composeMode: d.composeMode ?? null,
      intent: d.intent ?? null,
      hasPathSteps: (d.pathPlan?.steps?.length ?? 0) > 0,
      hasSearchQuery: Boolean(d.searchQuery?.trim()),
      language,
      workspaceOp,
    };
  }
  const draft = state.answer?.trim() ?? "";
  if (!draft) return null;
  return {
    task: "save_offer",
    draft,
    attachmentAction: d.attachmentAction ?? null,
    composeMode: d.composeMode ?? null,
    intent: d.intent ?? null,
    hasPathSteps: (d.pathPlan?.steps?.length ?? 0) > 0,
    hasSearchQuery: Boolean(d.searchQuery?.trim()),
    language,
  };
};
