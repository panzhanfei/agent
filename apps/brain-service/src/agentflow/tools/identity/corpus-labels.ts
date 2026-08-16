import type { IntakeIdentityField } from "@/agentflow/agents/online/intake-coordinator/contract";

/** 语料表列名（对 excerpt，非用户问句词表） */
export const IDENTITY_CORPUS_FIELD_LABELS: Record<
  IntakeIdentityField,
  string[]
> = {
  name: ["姓名", "名字"],
  age: ["出生", "年龄", "出生日期", "出生年月"],
  birthYear: ["出生年份", "出生日期", "出生年月", "出生"],
  email: ["邮箱", "邮件", "email"],
  phone: ["电话", "手机", "联系方式"],
  education: ["学历", "毕业", "院校"],
  career: ["行业", "职业", "从事", "领域"],
  tenure: ["工作经历", "时间线", "时间段", "任职"],
};
