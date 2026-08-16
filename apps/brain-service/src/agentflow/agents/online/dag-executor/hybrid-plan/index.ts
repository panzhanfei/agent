import type { RoutedIntakeDecision } from "@/agentflow/agents/online/intake-coordinator";
import { extractCompanyHint } from "@/agentflow/agents/online/intake-coordinator/path-plan/company-hint";
import type { ExecutionPlanNode } from "@/agentflow/agents/online/tool-orchestrator/interface";

/** 语料简历 + 联网公司/市场 + synthesize（deps 拓扑） */
export const buildHybridExecutionPlan = (
  userQuestion: string,
  decision: RoutedIntakeDecision
): ExecutionPlanNode[] => {
  const company = extractCompanyHint(userQuestion, decision.searchQuery);
  const year = new Date().getFullYear();
  return [
    {
      id: "resume",
      label: "个人简历",
      dataSource: "corpus",
      toolId: "retrieve_corpus",
      searchQuery: "个人简介 简历 技能 经历 项目",
      queryType: "identity",
      topics: ["personal", "resume"],
      field: null,
      deps: [],
    },
    {
      id: "company",
      label: "目标公司",
      dataSource: "web",
      toolId: "search_web",
      webQuery: `${company} 公司 业务 招聘 发展 最近`,
      deps: [],
    },
    {
      id: "market",
      label: "市场行情",
      dataSource: "web",
      toolId: "search_web",
      webQuery: `${year} 年 市场行情 行业趋势 招聘`,
      deps: [],
    },
    {
      id: "synthesis",
      label: "综合评估",
      dataSource: "synthesize",
      toolId: "synthesize_merge",
      deps: ["resume", "company", "market"],
    },
  ];
};
