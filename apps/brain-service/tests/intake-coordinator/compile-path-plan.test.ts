import { describe, expect, it } from "vitest";
import {
  applyPathPlanGuard,
  deriveCompositeSlotsFromPathPlan,
  emptyPathPlan,
  ensureMemRecallStepFromTopUserFact,
  legalizePathPlan,
  stepsOfKind,
  type RoutedIntakeDecision,
} from "@/agentflow/agents/online/intake-coordinator";

const base = (): RoutedIntakeDecision => ({
  intent: "retrieve_and_answer",
  searchQuery: "项目经历",
  subTasks: ["列举所有项目", "开源项目的 GitHub 与线上地址"],
  topics: ["project", "personal"],
  language: "zh",
  confidence: 0.9,
  queryType: "enumeration",
  clarifyingQuestion: null,
  briefReply: null,
  retrievalPlan: [],
  userFactKey: null,
  userFactLabel: null,
  userFactValue: null,
  routeMode: "planFanOut",
  compositeSlots: [],
  pathPlan: emptyPathPlan(),
  answerOrder: [],
  composeMode: "qa",
});

describe("legalizePathPlan + deriveCompositeSlots", () => {
  it("legalizes enumeration + external_link as km/list (no scene DAG)", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "list-projects",
          kind: "list",
          label: "列举所有项目名称",
          searchQuery: "项目经历 全部项目 项目名称",
          queryType: "enumeration",
          topics: ["project"],
          enumerationControl: {
            action: "exhaustive",
            listKind: "project",
            excludeHint: null,
          },
        },
        {
          id: "km-links",
          kind: "km",
          label: "开源项目的 GitHub 与线上地址",
          searchQuery: "个人简介 简历 开源 GitHub",
          queryType: "external_link",
          topics: ["personal", "resume", "project"],
          toolId: "extract_external_links_from_hits",
          dataSource: "corpus",
        },
      ],
    });
    expect(stepsOfKind(pathPlan, "dag")).toHaveLength(0);
    expect(
      stepsOfKind(pathPlan, "km").some((k) => k.queryType === "external_link")
    ).toBe(true);
    expect(stepsOfKind(pathPlan, "list").length).toBe(1);
    const slots = deriveCompositeSlotsFromPathPlan(pathPlan);
    expect(slots.map((s) => s.executor)).toEqual([
      "list_corpus",
      "km_retrieve",
    ]);
  });

  it("rewrites userFactKey (no identityField) → kind=mem", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "km-qq",
          kind: "km",
          label: "QQ号",
          searchQuery: "QQ",
          queryType: "identity",
          topics: ["personal"],
          userFactKey: "qq",
          userFactLabel: "QQ号",
        },
      ],
    });
    expect(pathPlan.steps).toHaveLength(1);
    expect(pathPlan.steps[0]?.kind).toBe("mem");
    expect(pathPlan.steps[0]?.dataSource).toBe("mem0");
    expect(pathPlan.steps[0]?.userFactKey).toBe("qq");
    expect(pathPlan.steps[0]?.toolId).toBeNull();
    const slots = deriveCompositeSlotsFromPathPlan(pathPlan);
    expect(slots[0]?.executor).toBe("mem_recall");
  });

  it("rewrites search_web on km → kind=tool", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "km-company",
          kind: "km",
          label: "公司概况",
          searchQuery: "奥卡云 公司",
          queryType: "default",
          topics: ["external"],
          toolId: "search_web",
          dataSource: "web",
        },
      ],
    });
    expect(pathPlan.steps[0]?.kind).toBe("tool");
    expect(deriveCompositeSlotsFromPathPlan(pathPlan)[0]?.executor).toBe(
      "tool_run"
    );
  });

  it("keeps identityField phone as km (not mem)", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "km-phone",
          kind: "km",
          label: "手机号",
          searchQuery: "个人简介 简历 电话 手机",
          queryType: "identity",
          topics: ["personal", "resume"],
          identityField: "phone",
          toolId: "extract_identity_from_hits",
          dataSource: "corpus",
        },
      ],
    });
    expect(pathPlan.steps[0]?.kind).toBe("km");
    expect(pathPlan.steps[0]?.identityField).toBe("phone");
  });

  it("applyPathPlanGuard preserves Intake slot order", () => {
    const routed = base();
    routed.compositeSlots = [
      {
        id: "identity-0",
        label: "年龄",
        searchQuery: "个人简介 简历 年龄",
        queryType: "identity",
        topics: ["personal", "resume"],
        subTasks: ["年龄"],
        identityField: "age",
        executor: "km_retrieve",
      },
      {
        id: "identity-1",
        label: "姓名",
        searchQuery: "个人简介 简历 姓名",
        queryType: "identity",
        topics: ["personal", "resume"],
        subTasks: ["姓名"],
        identityField: "name",
        executor: "km_retrieve",
      },
      {
        id: "projects-2",
        label: "项目经历",
        searchQuery: "项目经历 全部项目",
        queryType: "enumeration",
        topics: ["project"],
        subTasks: ["项目经历"],
        executor: "list_corpus",
        enumerationControl: {
          action: "exhaustive",
          listKind: "project",
          excludeHint: null,
        },
      },
      {
        id: "external_link-3",
        label: "开源链接",
        searchQuery: "对外链接",
        queryType: "external_link",
        topics: ["personal", "resume", "project"],
        subTasks: ["开源链接"],
        executor: "km_retrieve",
      },
    ];
    const withPlan = applyPathPlanGuard(
      routed,
      "我今年多大了？叫什么？列出项目和开源地址"
    );
    expect(stepsOfKind(withPlan.pathPlan, "dag")).toHaveLength(0);
    expect(withPlan.composeMode).toBe("composite");
    expect(withPlan.compositeSlots.map((s) => s.queryType)).toEqual([
      "identity",
      "identity",
      "enumeration",
      "external_link",
    ]);
    expect(withPlan.compositeSlots.map((s) => s.label)).toEqual([
      "年龄",
      "姓名",
      "项目经历",
      "开源链接",
    ]);
  });

  it("strips extract_identity toolId when identityField illegal/missing", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "km-sil",
          kind: "km",
          label: "嫂子姓名",
          searchQuery: "亲友关系 嫂子 姓名",
          queryType: "identity",
          topics: ["personal"],
          identityField: "sisterInLawName",
          toolId: "extract_identity_from_hits",
          dataSource: "corpus",
        },
      ],
    });
    expect(pathPlan.steps).toHaveLength(1);
    expect(pathPlan.steps[0]?.identityField).toBeNull();
    expect(pathPlan.steps[0]?.toolId).toBeNull();
    expect(pathPlan.steps[0]?.queryType).toBe("default");
    expect(pathPlan.steps[0]?.kind).toBe("km");
  });

  it("legalizes birthYear and fills extract_identity toolId", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "km-birth-year",
          kind: "km",
          label: "出生年份",
          searchQuery: "个人简介 简历 出生年份 出生日期",
          queryType: "identity",
          topics: ["personal", "resume"],
          identityField: "birthYear",
          toolId: null,
          dataSource: "corpus",
        },
      ],
    });
    expect(pathPlan.steps[0]?.identityField).toBe("birthYear");
    expect(pathPlan.steps[0]?.toolId).toBe("extract_identity_from_hits");
  });

  it("legalizes employer tenure and fills compute_tenure toolId", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "km-tenure",
          kind: "km",
          label: "西安奥卡云任职年限",
          searchQuery: "西安奥卡云 任职 年限 时间段",
          queryType: "identity",
          topics: ["experience"],
          identityField: "tenure",
          toolId: null,
          dataSource: "compute",
        },
      ],
    });
    expect(pathPlan.steps[0]?.identityField).toBe("tenure");
    expect(pathPlan.steps[0]?.toolId).toBe("compute_tenure_from_hits");
    expect(pathPlan.steps[0]?.searchQuery).toMatch(/西安奥卡云/);
  });

  it("remaps lowercase open-fact identityField (qq) to mem", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "km-qq",
          kind: "km",
          label: "QQ号",
          searchQuery: "个人简介 简历 QQ号",
          queryType: "identity",
          topics: ["personal", "resume"],
          identityField: "qq",
          toolId: "extract_identity_from_hits",
          dataSource: "corpus",
        },
      ],
    });
    expect(pathPlan.steps).toHaveLength(1);
    expect(pathPlan.steps[0]?.kind).toBe("mem");
    expect(pathPlan.steps[0]?.userFactKey).toBe("qq");
    expect(pathPlan.steps[0]?.dataSource).toBe("mem0");
    expect(pathPlan.steps[0]?.identityField).toBeNull();
  });

  it("remaps km-qq step.id to mem when identityField omitted", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "km-qq",
          kind: "km",
          label: "QQ号",
          searchQuery: "个人信息 QQ号 联系方式",
          queryType: "identity",
          topics: ["personal", "resume"],
          identityField: null,
          toolId: "extract_identity_from_hits",
          dataSource: "corpus",
        },
      ],
    });
    expect(pathPlan.steps).toHaveLength(1);
    expect(pathPlan.steps[0]?.kind).toBe("mem");
    expect(pathPlan.steps[0]?.userFactKey).toBe("qq");
    expect(pathPlan.steps[0]?.dataSource).toBe("mem0");
  });

  it("demotes identityField when topics include family", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "km-brother",
          kind: "km",
          label: "哥哥姓名",
          searchQuery: "个人简介 简历 妻子的姐妹 名字",
          queryType: "identity",
          topics: ["personal", "family"],
          identityField: "name",
          toolId: "extract_identity_from_hits",
          dataSource: "corpus",
        },
      ],
    });
    expect(pathPlan.steps[0]?.identityField).toBeNull();
    expect(pathPlan.steps[0]?.toolId).toBeNull();
    expect(pathPlan.steps[0]?.queryType).toBe("default");
    expect(pathPlan.steps[0]?.searchQuery).toBe("亲友关系 哥哥姓名");
  });

  it("does not convert km+mem0 without userFactKey into mem", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "km-brother",
          kind: "km",
          label: "哥哥姓名",
          searchQuery: "亲友关系 哥哥 姓名",
          queryType: "default",
          topics: ["personal", "family"],
          identityField: null,
          toolId: null,
          dataSource: "mem0",
        },
      ],
    });
    expect(pathPlan.steps[0]?.kind).toBe("km");
    expect(pathPlan.steps[0]?.dataSource).toBe("corpus");
  });

  it("routes preview enumeration to list_corpus", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "list-preview",
          kind: "list",
          label: "项目经历",
          searchQuery: "项目经历 全部项目",
          queryType: "enumeration",
          topics: ["project"],
          enumerationControl: {
            action: "preview",
            listKind: "project",
            excludeHint: null,
          },
        },
      ],
    });
    const slots = deriveCompositeSlotsFromPathPlan(pathPlan);
    expect(slots).toHaveLength(1);
    expect(slots[0]?.executor).toBe("list_corpus");
    expect(slots[0]?.enumerationControl?.action).toBe("preview");
  });

  it("injects mem step when top-level userFactKey has no value", () => {
    const pathPlan = legalizePathPlan({
      steps: [
        {
          id: "km-name",
          kind: "km",
          label: "姓名",
          searchQuery: "姓名",
          queryType: "identity",
          topics: ["personal"],
          identityField: "name",
          toolId: "extract_identity_from_hits",
          dataSource: "corpus",
        },
        {
          id: "km-age",
          kind: "km",
          label: "年龄",
          searchQuery: "年龄",
          queryType: "identity",
          topics: ["personal"],
          identityField: "age",
          toolId: "compute_age_from_hits",
          dataSource: "compute",
        },
        {
          id: "km-phone",
          kind: "km",
          label: "手机号",
          searchQuery: "手机",
          queryType: "identity",
          topics: ["personal"],
          identityField: "phone",
          toolId: "extract_identity_from_hits",
          dataSource: "corpus",
        },
      ],
    });
    const patched = ensureMemRecallStepFromTopUserFact(
      {
        intent: "retrieve_and_answer",
        userFactKey: "qq",
        userFactLabel: "QQ号",
        userFactValue: null,
      },
      pathPlan
    );
    expect(stepsOfKind(patched, "mem")).toHaveLength(1);
    expect(patched.steps[2]?.id).toBe("mem-qq");
    expect(patched.steps[2]?.userFactKey).toBe("qq");
    const slots = deriveCompositeSlotsFromPathPlan(patched);
    expect(slots.some((s) => s.executor === "mem_recall")).toBe(true);
  });
});
