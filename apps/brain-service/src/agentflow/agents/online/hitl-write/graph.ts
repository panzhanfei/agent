/**
 * 文件 HITL 子图：propose → interrupt → apply（快照+写盘+按 path 向量）
 * checkpointer: MemorySaver（进程内）；提案持久化在 DB，跨请求可 Apply 兜底。
 */
import { Annotation, END, MemorySaver, START, StateGraph, interrupt, Command } from "@langchain/langgraph";
import { applyCorpusEditProposal, rejectCorpusEditProposal } from "./apply";
import { parseEditOperation, proposeCorpusEdit, targetPathFromStep } from "./propose";
import type { CorpusEditOperation, CorpusEditResumeAction } from "./interface";

const CorpusEditAnnotation = Annotation.Root({
  userId: Annotation<string>,
  corpusUserId: Annotation<string>,
  conversationId: Annotation<string | null>,
  turnId: Annotation<string | null>,
  threadId: Annotation<string>,
  targetPath: Annotation<string>,
  operation: Annotation<CorpusEditOperation>,
  afterContent: Annotation<string>,
  proposalId: Annotation<string | null>,
  resumeAction: Annotation<CorpusEditResumeAction | null>,
  error: Annotation<string | null>,
  applied: Annotation<boolean>,
  indexedChunks: Annotation<number>,
});

export type CorpusEditGraphState = typeof CorpusEditAnnotation.State;

const proposeNode = async (
  state: CorpusEditGraphState
): Promise<Partial<CorpusEditGraphState>> => {
  const proposed = await proposeCorpusEdit({
    userId: state.userId,
    corpusUserId: state.corpusUserId,
    conversationId: state.conversationId,
    turnId: state.turnId,
    threadId: state.threadId,
    targetPath: state.targetPath,
    operation: state.operation,
    afterContent: state.afterContent,
  });
  if (!proposed.ok) {
    return { error: proposed.error, proposalId: null, applied: false };
  }

  const decision = interrupt({
    proposalId: proposed.proposal.proposalId,
    repoPath: proposed.proposal.repoPath,
    operation: proposed.proposal.operation,
    beforeContent: proposed.proposal.beforeContent,
    afterContent: proposed.proposal.afterContent,
  }) as { action?: CorpusEditResumeAction } | CorpusEditResumeAction;

  const action: CorpusEditResumeAction =
    typeof decision === "string"
      ? decision
      : decision?.action === "reject"
        ? "reject"
        : "approve";

  return {
    proposalId: proposed.proposal.proposalId,
    resumeAction: action,
    error: null,
  };
};

const applyNode = async (
  state: CorpusEditGraphState
): Promise<Partial<CorpusEditGraphState>> => {
  const proposalId = state.proposalId;
  if (!proposalId) {
    return { error: state.error ?? "missing_proposal", applied: false };
  }
  if (state.resumeAction === "reject") {
    await rejectCorpusEditProposal({
      proposalId,
      userId: state.userId,
    });
    return { applied: false, indexedChunks: 0 };
  }
  const result = await applyCorpusEditProposal({
    proposalId,
    userId: state.userId,
  });
  if (!result.ok) {
    return {
      error: result.error ?? "apply_failed",
      applied: false,
      indexedChunks: 0,
    };
  }
  return { applied: true, indexedChunks: result.indexedChunks, error: null };
};

const checkpointer = new MemorySaver();

const buildCorpusEditGraph = () =>
  new StateGraph(CorpusEditAnnotation)
    .addNode("propose", proposeNode)
    .addNode("apply", applyNode)
    .addEdge(START, "propose")
    .addEdge("propose", "apply")
    .addEdge("apply", END);

let compiled: ReturnType<ReturnType<typeof buildCorpusEditGraph>["compile"]> | null =
  null;

export const getCompiledCorpusEditGraph = () => {
  if (!compiled) {
    compiled = buildCorpusEditGraph().compile({
      checkpointer,
      name: "fambrain-corpus-edit",
    });
  }
  return compiled;
};

export const startCorpusEditGraph = async (input: {
  userId: string;
  corpusUserId: string;
  conversationId?: string | null;
  turnId?: string | null;
  threadId: string;
  targetPath: string;
  operation: CorpusEditOperation;
  afterContent: string;
}) => {
  const graph = getCompiledCorpusEditGraph();
  const result = await graph.invoke(
    {
      userId: input.userId,
      corpusUserId: input.corpusUserId,
      conversationId: input.conversationId ?? null,
      turnId: input.turnId ?? null,
      threadId: input.threadId,
      targetPath: input.targetPath,
      operation: input.operation,
      afterContent: input.afterContent,
      proposalId: null,
      resumeAction: null,
      error: null,
      applied: false,
      indexedChunks: 0,
    },
    { configurable: { thread_id: input.threadId } }
  );
  return result;
};

export const resumeCorpusEditGraph = async (input: {
  threadId: string;
  action: CorpusEditResumeAction;
}) => {
  const graph = getCompiledCorpusEditGraph();
  return graph.invoke(new Command({ resume: { action: input.action } }), {
    configurable: { thread_id: input.threadId },
  });
};

export { parseEditOperation, targetPathFromStep, Command };
