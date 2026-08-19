/**
 * DAG 拓扑执行：按 deps 分波；再批用 seed + 下游闭包，不整图盲重跑。
 * 单节点怎么跑仍走 tool-orchestrator.runExecutionPlanNode。
 */
import { logAgentOut } from "@fambrain/brain-shared/agent-log";
import type { ExecutionPlanNode } from "@/agentflow/agents/online/tool-orchestrator/interface";
import type { PipelineToolResults } from "@/agentflow/agents/online/tool-orchestrator/interface";
import { runExecutionPlanNode } from "@/agentflow/agents/online/tool-orchestrator/execute";
import {
  canReuseDagNodeResult,
  collectDownstreamRerunClosure,
  shouldSkipForDeps,
  skippedDepsResult,
  unsatisfiedOptionalDeps,
} from "@/agentflow/execution";
import type { PipelineGraphState } from "@/agentflow/pipeline/graph/state";
import type { ExecuteDagPlanOptions } from "../interface";

const topoWaves = (nodes: ExecutionPlanNode[]): ExecutionPlanNode[][] => {
  const idSet = new Set(nodes.map((n) => n.id));
  const remaining = new Map(nodes.map((n) => [n.id, n]));
  const waves: ExecutionPlanNode[][] = [];
  while (remaining.size > 0) {
    const wave = [...remaining.values()].filter((n) =>
      n.deps.every((d) => !remaining.has(d) && idSet.has(d))
    );
    if (wave.length === 0) break;
    waves.push(wave);
    for (const n of wave) remaining.delete(n.id);
  }
  return waves;
};

export const executeDagPlan = async (
  plan: ExecutionPlanNode[],
  state: PipelineGraphState,
  options?: ExecuteDagPlanOptions
): Promise<PipelineToolResults> => {
  const seed = options?.seedToolResults ?? null;
  const forceRoots = options?.forceRerunIds ?? [];
  const rerunSet =
    seed && [...forceRoots].length > 0
      ? collectDownstreamRerunClosure(plan, forceRoots)
      : new Set<string>();
  const useSeed = Boolean(seed) && rerunSet.size > 0;

  const results: PipelineToolResults = {};
  let skippedForDeps = 0;
  let reused = 0;
  let ran = 0;
  for (const wave of topoWaves(plan)) {
    const settled = await Promise.all(
      wave.map(async (node) => {
        if (
          useSeed &&
          !rerunSet.has(node.id) &&
          canReuseDagNodeResult(seed?.[node.id])
        ) {
          reused += 1;
          return [node.id, seed![node.id]!] as const;
        }

        const optionalDeps = node.optionalDeps ?? [];
        if (shouldSkipForDeps(node.deps, results, optionalDeps)) {
          skippedForDeps += 1;
          const missing = node.deps.filter(
            (d) =>
              !optionalDeps.includes(d) && (!results[d] || !results[d]?.ok)
          );
          return [
            node.id,
            skippedDepsResult({
              toolId: node.toolId,
              label: node.label,
              missingDeps: missing,
            }),
          ] as const;
        }
        const softMissing = unsatisfiedOptionalDeps(
          node.deps,
          results,
          optionalDeps
        );
        ran += 1;
        const result = await runExecutionPlanNode(node, {
          state,
          prior: results,
        });
        if (softMissing.length === 0) {
          return [node.id, result] as const;
        }
        const note = `可选依赖未就绪（${softMissing.join(", ")}），已降级继续。`;
        if (result.matchReport) {
          const { renderMatchReportMarkdown, matchReportToBlocks } =
            await import("@/agentflow/tools/local/synthesize");
          const matchReport = {
            ...result.matchReport,
            risks: [...result.matchReport.risks, { text: note }],
            conclusion:
              result.matchReport.conclusion === "适合"
                ? ("谨慎" as const)
                : result.matchReport.conclusion,
            evidenceGrade:
              result.matchReport.evidenceGrade === "sufficient"
                ? ("partial" as const)
                : result.matchReport.evidenceGrade,
          };
          const answer = renderMatchReportMarkdown(matchReport);
          return [
            node.id,
            {
              ...result,
              matchReport,
              answer,
              blocks: matchReportToBlocks(matchReport),
              confidence: Math.min(result.confidence, 0.75),
              insufficientEvidence: result.insufficientEvidence || !result.ok,
            },
          ] as const;
        }
        return [
          node.id,
          {
            ...result,
            answer: result.answer ? `${result.answer}\n\n（${note}）` : note,
            confidence: Math.min(result.confidence, 0.75),
            insufficientEvidence: result.insufficientEvidence || !result.ok,
          },
        ] as const;
      })
    );
    for (const [id, result] of settled) results[id] = result;
  }
  logAgentOut("DagExecutor", "完成", {
    nodeIds: Object.keys(results),
    synthesis: results.synthesis?.ok ?? null,
    skippedForDeps,
    reused,
    ran,
    forceRerun: [...rerunSet],
    partialReexec: useSeed,
  });
  return results;
};
