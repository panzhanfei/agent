import { describe, expect, it } from "vitest";
import {
  emptyPathPlan,
  resolveIntakeGraphRouteMode,
  type RoutedIntakeDecision,
} from "@/agentflow/agents/online/intake-coordinator";

const base = (): RoutedIntakeDecision => ({
  intent: "retrieve_and_answer",
  language: "zh",
  subTasks: [],
  topics: [],
  confidence: 0.9,
  clarifyingQuestion: null,
  briefReply: null,
  searchQuery: "q",
  queryType: "default",
  retrievalPlan: [],
  routeMode: "planExecutor",
  compositeSlots: [],
  pathPlan: emptyPathPlan(),
  answerOrder: [],
  composeMode: "qa",
  userFactKey: null,
  userFactLabel: null,
  userFactValue: null,
});

describe("resolveIntakeGraphRouteMode", () => {
  it("maps clarify to respondEarly", () => {
    expect(
      resolveIntakeGraphRouteMode({
        ...base(),
        intent: "clarify",
        clarifyingQuestion: "哪一个？",
        searchQuery: "",
      })
    ).toBe("respondEarly");
  });

  it("maps remember_user_fact to userFact", () => {
    expect(
      resolveIntakeGraphRouteMode({
        ...base(),
        intent: "remember_user_fact",
        userFactKey: "qq",
        userFactLabel: "QQ",
        userFactValue: "1",
      })
    ).toBe("userFact");
  });

  it("maps pure list slots to listRetriever", () => {
    expect(
      resolveIntakeGraphRouteMode({
        ...base(),
        pathPlan: {
          ...emptyPathPlan(),
          list: [
            {
              id: "list-0",
              pathKind: "list",
              label: "项目",
              searchQuery: "项目",
              queryType: "enumeration",
              topics: ["project"],
              enumerationControl: {
                action: "exhaustive",
                listKind: "project",
                excludeHint: null,
              },
            },
          ],
        },
        compositeSlots: [
          {
            id: "list-0",
            label: "项目",
            searchQuery: "项目",
            queryType: "enumeration",
            topics: ["project"],
            subTasks: ["项目"],
            executor: "list_corpus",
            enumerationControl: {
              action: "exhaustive",
              listKind: "project",
              excludeHint: null,
            },
          },
        ],
      })
    ).toBe("listRetriever");
  });

  it("maps km+dag to planExecutor (coexist)", () => {
    expect(
      resolveIntakeGraphRouteMode({
        ...base(),
        pathPlan: {
          ...emptyPathPlan(),
          km: [
            {
              id: "km-0",
              pathKind: "km",
              label: "年龄",
              searchQuery: "年龄",
              queryType: "identity",
              topics: [],
            },
          ],
          dag: [
            {
              id: "dag-0",
              pathKind: "dag",
              label: "评估",
              template: "hybrid_multi_source",
            },
          ],
        },
        compositeSlots: [
          {
            id: "km-0",
            label: "年龄",
            searchQuery: "年龄",
            queryType: "identity",
            topics: [],
            subTasks: ["年龄"],
          },
        ],
        executionPlan: [
          {
            id: "resume",
            label: "简历",
            dataSource: "corpus",
            toolId: "retrieve_corpus",
            deps: [],
          },
        ],
      })
    ).toBe("planExecutor");
  });
});
