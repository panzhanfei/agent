import { END, START, StateGraph } from "@langchain/langgraph";
import { withPipelineRunAls } from "@fambrain/brain-shared/pipeline-run-context";
import { getPipelineCheckpointer } from "@/agentflow/execution";
import { FileGraphAnnotation } from "./state";
import { runSaveHitlNode } from "../save-hitl";
import { runWorkspaceNode } from "../workspace";

const als = withPipelineRunAls;

const routeFileStart = (
  state: typeof FileGraphAnnotation.State
): "workspace" | "saveHitl" =>
  state.envelope.task === "workspace" ? "workspace" : "saveHitl";

const buildFileGraph = () => {
  return new StateGraph(FileGraphAnnotation)
    .addNode("workspace", als(runWorkspaceNode))
    .addNode("saveHitl", als(runSaveHitlNode))
    .addConditionalEdges(START, routeFileStart)
    .addEdge("workspace", END)
    .addEdge("saveHitl", END);
};

let compiledFileGraph: ReturnType<
  ReturnType<typeof buildFileGraph>["compile"]
> | null = null;

export const getCompiledFileGraph = () => {
  if (!compiledFileGraph) {
    compiledFileGraph = buildFileGraph().compile({
      name: "fambrain-file",
      checkpointer: getPipelineCheckpointer(),
    });
  }
  return compiledFileGraph;
};

export const resetCompiledFileGraph = (): void => {
  compiledFileGraph = null;
};
