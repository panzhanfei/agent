import { Annotation } from "@langchain/langgraph";
import type { AssistantMessageBlock } from "@fambrain/brain-types";
import type {
  FileAgentEnvelope,
  FileAgentResult,
} from "../interface";
import type { VaultWorkspaceParams } from "../vault";

export const FileGraphAnnotation = Annotation.Root({
  jobId: Annotation<string>,
  envelope: Annotation<FileAgentEnvelope>,
  corpusUserId: Annotation<string>,
  conversationId: Annotation<string>,
  language: Annotation<"zh" | "en">,
  workspaceParams: Annotation<VaultWorkspaceParams | null>,
  answer: Annotation<string | null>,
  assistantBlocks: Annotation<AssistantMessageBlock[] | null>,
  result: Annotation<FileAgentResult | null>,
  error: Annotation<string | null>,
});

export type FileGraphState = typeof FileGraphAnnotation.State;
